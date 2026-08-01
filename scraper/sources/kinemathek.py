"""Open-air screenings from the Bonner Kinemathek's own programme page.

The Kinemathek runs four venues and publishes all of them on one page: Kino in
der Brotfabrik and the LVR-LandesMuseum — both of which we already take from
kinoheld, where they are bookable — plus two open-airs that appear nowhere else,
the roof of the Bundeskunsthalle and the Friesdorfer Freibad. Those two are what
this module is for. A cinema entry says which venue string to keep
(`venue_match`), so the same scraper serves both without them colliding.

Two things about this source are worth knowing:

**Use the HTML, not their events.ics.** The site does publish an iCal feed at
/events.ics, and it is tempting: 42 events, clean fields, one request. But its
DTSTARTs are stamped "Z" while carrying local time minus one hour. Checked
2026-08-01 two ways — the page prints "DIE ODYSSEE … 20:30" where the feed says
19:30Z, and for the LVR screenings, which we also get from kinoheld, kinoheld's
19:30 matches the page and not the feed. An hour-early showtime is exactly the
kind of quiet error this project refuses to ship, so the printed time wins.

**Their markup is the WordPress "Events Manager" plugin**, which is stable and
easy to read:

    <div class="em-event em-item em-list-item" data-href="<detail page>">
      <h3 class="em-item-title"><a …>DIE ODYSSEE</a></h3>
      <div class="em-item-meta-line em-event-date …"><span …></span> 28.08.2026 </div>
      <div class="em-item-meta-line em-event-time …"><span …></span> 20:30 </div>
      <div class="em-item-meta-line em-event-time …"><span …></span> USA 2026 </div>
      <div class="em-item-meta-line em-event-location"><span …></span> Bundeskunsthalle </div>

The "USA 2026" line gives us a year, which we pass on as a hint — that is what
keeps a shorts programme like "Kurze Filme für hohe Dächer" from borrowing some
unrelated film's poster: with a year hint TMDB's picker returns nothing unless a
hit matches it.

Debug helper:
  python -m sources.kinemathek Bundeskunsthalle
"""
from __future__ import annotations

import html
import re
import sys
from datetime import datetime, timedelta, timezone

import requests

from language import classify

PROGRAM_URL = "https://www.bonnerkinemathek.de/programm/"
HEADERS = {"User-Agent": "Mozilla/5.0 (kinoguide-koeln; personal project; "
                        "+https://kinoguide.github.io)"}

_EVENT = re.compile(r'class="em-event em-item em-list-item"\s+data-href="([^"]+)"')
_TITLE = re.compile(r'class="em-item-title[^"]*">\s*<a[^>]*>(.*?)</a>', re.S)
_DATE = re.compile(r'em-icon-calendar[^>]*></span>\s*([0-3]?\d\.[01]?\d\.\d{4})')
_TIME = re.compile(r'em-icon-clock[^>]*></span>\s*([0-2]?\d:[0-5]\d)')
_INFO = re.compile(r'em-icon-info[^>]*></span>\s*([^<]*)')
_LOCATION = re.compile(r'em-event-location[^>]*>\s*<span[^>]*></span>\s*([^<]*)')
_YEAR = re.compile(r"\b(19\d{2}|20\d{2})\b")
_TAG = re.compile(r"<[^>]+>")

# Their titles carry the series they belong to ("Filmnächte im Friesdorfer
# Freibad: Der weiße Hai") and sometimes a release note ("VATERLAND (VORPREMIERE
# VOR DEM KINO-START)"). Both would be searched verbatim on TMDB and match
# nothing, so they come off — narrowly, by name, rather than by stripping every
# prefix and bracket, which would eat real titles like "Blade Runner (Final Cut)".
_SERIES = re.compile(r"^(?:filmnächte|open[- ]?air|kurzfilmprogramm)[^:]*:\s*", re.I)
_RELEASE_NOTE = re.compile(r"\s*\([^()]*(?:premiere|kino-?start)[^()]*\)\s*$", re.I)
# a compilation of shorts is not a film TMDB could ever hold
_NOT_A_FILM = re.compile(r"kurzfilmprogramm|kurze filme", re.I)


def _last_sunday(year: int, month: int) -> datetime:
    """The last Sunday of a month, at midnight."""
    d = datetime(year, month + 1, 1) if month < 12 else datetime(year + 1, 1, 1)
    d -= timedelta(days=1)
    return d - timedelta(days=(d.weekday() + 1) % 7)


def _berlin_offset(local: datetime) -> timezone:
    """CEST or CET for a Berlin wall-clock time, without a timezone database.

    EU rule: summer time runs from the last Sunday in March 02:00 local to the
    last Sunday in October 03:00 local. Computing it beats importing zoneinfo,
    whose database Windows does not ship — and this repo is run from Windows.
    """
    start = _last_sunday(local.year, 3) + timedelta(hours=2)
    end = _last_sunday(local.year, 10) + timedelta(hours=3)
    return timezone(timedelta(hours=2 if start <= local < end else 1))


def _text(chunk: str, pattern: re.Pattern) -> str:
    m = pattern.search(chunk)
    # unescape: their titles arrive with numeric entities ("Glennkill &#8211; …")
    return html.unescape(_TAG.sub("", m.group(1))).strip() if m else ""


def fetch_shows(cinema: dict) -> list[dict]:
    """Screenings at one Kinemathek venue, selected by its `venue_match`."""
    want = cinema.get("venue_match") or cinema["name"]
    html = requests.get(cinema.get("url") or PROGRAM_URL,
                        headers=HEADERS, timeout=30).text

    # cut the page into one chunk per event: everything from an event's opening
    # div up to the next one
    starts = [(m.start(), m.group(1)) for m in _EVENT.finditer(html)]
    shows = []
    for i, (pos, detail_url) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(html)
        chunk = html[pos:end]

        if want.lower() not in _text(chunk, _LOCATION).lower():
            continue
        title = _text(chunk, _TITLE)
        date, time_ = _text(chunk, _DATE), _text(chunk, _TIME)
        if not (title and date and time_):
            continue

        day, month, year = (int(x) for x in date.split("."))
        hour, minute = (int(x) for x in time_.split(":"))
        local = datetime(year, month, day, hour, minute)

        years = {int(y) for y in _YEAR.findall(_text(chunk, _INFO))}
        is_film = not _NOT_A_FILM.search(title)
        title = _RELEASE_NOTE.sub("", _SERIES.sub("", title)).strip()
        shows.append({
            "title": title,
            "is_film": is_film,
            "datetime": local.replace(tzinfo=_berlin_offset(local)).isoformat(),
            "language": classify(title),
            # not a ticket link: this venue sells none. main.py keeps it in
            # booking_url all the same, and the frontend labels it "ℹ️ Infos"
            # because the cinema is marked ticketing: "info".
            "booking_url": detail_url,
            "years": sorted(years),
        })
    return shows


if __name__ == "__main__":  # pragma: no cover - debug helper
    venue = sys.argv[1] if len(sys.argv) > 1 else "Bundeskunsthalle"
    for s in fetch_shows({"name": venue, "venue_match": venue}):
        print(f"{s['datetime'][:16]}  {s['language']:<3}  {s['title'][:45]:<47}"
              f"{s['years']}  {s['booking_url']}")
