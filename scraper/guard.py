"""Refuse to ship a scrape that quietly lost data.

main.py isolates a failing cinema so one broken source can't abort the run.
That is right for the run and wrong for the site: the cinema simply vanishes
from movies.json and the page looks perfectly normal without it. The same goes
for an expired TMDB key (every poster gone), an expired OMDb key (every rating
gone, which also scrambles the default sort) and for the booking-link bugs that
already shipped twice — the data was well-formed every time.

So before writing, the new payload is compared against the one already on disk,
which is yesterday's committed data. If something collapsed, the run fails and
the old file stays in place: stale but correct beats fresh but wrong (see the
project's data-accuracy rule).

Comparing raw totals would be noise. Cinemas publish a Do–Mi week and extend it
on Mon/Tue, so the program legitimately shrinks by a day every day until the new
week appears. Every count here is therefore taken over *the same set of dates* —
the days from today on that yesterday's file already had — which removes the
horizon effect and leaves a real regression.

Escape hatch: `python main.py --force` writes anyway. For the day a cinema
really does close for the summer.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime

# A source this small can swing by half on an ordinary day (one open-air night,
# one festival slot), so below this baseline a drop proves nothing.
MIN_BASELINE = 6
# Above the baseline, losing half a cinema's screenings is not a programme
# change, it's a broken scraper.
MAX_CINEMA_DROP = 0.50
# The whole guide across all cinemas is far steadier than any single one.
MAX_TOTAL_DROP = 0.25
# Share of films with a poster / with an IMDb rating / of screenings with a
# ticket link. These only move slowly; a cliff means a key expired or a link
# builder broke. In percentage points.
MAX_SHARE_DROP = 0.12


def _today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _shows_by_cinema_day(payload: dict) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for movie in payload.get("movies", []):
        for show in movie.get("showtimes", []):
            out[show["cinema"]][show["datetime"][:10]] += 1
    return out


def _shares(payload: dict) -> dict[str, float]:
    """The three ratios that catch a silent enrichment or link failure."""
    movies = payload.get("movies", [])
    shows = [s for m in movies for s in m.get("showtimes", [])]
    if not movies or not shows:
        return {}
    # A venue with no ticket shop links to its own site on purpose, so an
    # "info" screening is not a missing link.
    sellable = [s for s in shows if not s.get("info")]
    out = {
        "films with a poster": sum(1 for m in movies if m.get("poster")) / len(movies),
        "films with an IMDb rating":
            sum(1 for m in movies if (m.get("ratings") or {}).get("imdb")) / len(movies),
    }
    if sellable:
        out["screenings with a ticket link"] = \
            sum(1 for s in sellable if s.get("booking_url")) / len(sellable)
    return out


def check(new: dict, old: dict | None, today: str | None = None) -> list[str]:
    """Return a list of human-readable problems; empty means the scrape is sane."""
    if not old or not old.get("movies"):
        return []  # first run, or no previous data to compare against
    today = today or _today()

    problems: list[str] = []
    old_days = _shows_by_cinema_day(old)
    new_days = _shows_by_cinema_day(new)

    total_before = total_after = 0
    for cinema, days in sorted(old_days.items()):
        # the window: days yesterday's file covered that haven't happened yet
        window = [d for d in days if d >= today]
        before = sum(days[d] for d in window)
        after = sum(new_days.get(cinema, {}).get(d, 0) for d in window)
        total_before += before
        total_after += after
        if before < MIN_BASELINE:
            continue
        if after == 0:
            problems.append(
                f"{cinema} has no screenings left at all (had {before} for "
                f"{today} and later). Its scraper most likely failed - look for "
                f"an [error] line above.")
        elif after < before * (1 - MAX_CINEMA_DROP):
            problems.append(
                f"{cinema} dropped from {before} to {after} screenings on the "
                f"same days ({100 - round(after / before * 100)}% gone).")

    if total_before >= MIN_BASELINE and total_after < total_before * (1 - MAX_TOTAL_DROP):
        problems.append(
            f"The whole programme dropped from {total_before} to {total_after} "
            f"screenings on the same days.")

    old_shares, new_shares = _shares(old), _shares(new)
    for label, before in old_shares.items():
        after = new_shares.get(label, 0.0)
        if after < before - MAX_SHARE_DROP:
            problems.append(
                f"Only {after:.0%} of {label}, it was {before:.0%} yesterday. "
                f"Check the API keys (TMDB/OMDb) and the ticket-link builders.")

    return problems


def price_warnings(new: dict, old: dict | None) -> list[str]:
    """Cinemas whose exact prices thinned out. Never fatal — the frontend has
    the curated table to fall back on, and says so with '≈ geschätzt'."""
    if not old:
        return []
    out = []
    for name, before in (old.get("cinemas") or {}).items():
        n_before = len(before.get("shows") or {})
        n_after = len((new.get("cinemas", {}).get(name, {}).get("shows")) or {})
        if n_before >= MIN_BASELINE and n_after < n_before * (1 - MAX_CINEMA_DROP):
            out.append(f"{name}: exact prices for {n_after} screenings, "
                       f"was {n_before}. Falling back to the price table.")
    return out


def say(line: str) -> None:
    """print() that cannot itself fail.

    Half these messages name a cinema, and "Koelner Filmhaus" is spelled with an
    umlaut. On a Windows console in its default codepage that raises
    UnicodeEncodeError — which would hide the very problem being reported.
    """
    try:
        print(line)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"))


def report(problems: list[str]) -> None:
    say("\n" + "=" * 68)
    say("STOPPED: this scrape lost data, so it was NOT written.")
    say("=" * 68)
    for p in problems:
        say(f"  * {p}")
    say("\nThe previous data/movies.json is untouched - the site keeps showing")
    say("yesterday's programme, which is better than a wrong one.")
    say("If the change is real (a cinema closed, a festival ended), run:")
    say("    python main.py --force")
    say("=" * 68)
