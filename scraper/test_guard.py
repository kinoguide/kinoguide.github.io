"""Exercise guard.check() against the real data/movies.json.

    cd scraper && python test_guard.py

Run it after touching guard.py. Half of these cases assert the guard stays
*quiet*: a watchdog that cries wolf on an ordinary Tuesday gets disabled, and
then it protects nothing. Nothing here is hard-coded to a date or a cinema —
the fixture is whatever the current data holds, so the test doesn't rot.
"""
from __future__ import annotations

import collections
import copy
import json
import os
import sys

import guard

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data", "movies.json")

with open(DATA, encoding="utf-8") as f:
    REAL = json.load(f)

# "today" = the first day the data covers, so the whole programme lies ahead
# exactly as it does on the morning of a real run
TODAY = min(s["datetime"][:10] for m in REAL["movies"] for s in m["showtimes"])

_counts = collections.Counter(
    s["cinema"] for m in REAL["movies"] for s in m["showtimes"])
BIG = _counts.most_common(1)[0][0]                  # a house that must be missed
BIG2 = _counts.most_common(2)[1][0]
TINY = min(_counts, key=_counts.get)                # the day's smallest house

failures = 0


def case(name: str, new: dict, want_problems: bool, old: dict | None = REAL) -> None:
    global failures
    got = guard.check(new, old, today=TODAY)
    good = bool(got) == want_problems
    failures += not good
    print(f"{'PASS' if good else 'FAIL'}  {name}")
    for g in got:
        guard.say(f"        -> {g}")


def thin(cinema: str, keep: float = 0.0) -> dict:
    """A copy of the data with only `keep` of one cinema's screenings left."""
    p = copy.deepcopy(REAL)
    n = 0  # counts across the whole payload, not per film
    for m in p["movies"]:
        left = []
        for s in m["showtimes"]:
            if s["cinema"] != cinema:
                left.append(s)
            else:
                n += 1
                if n % 100 < keep * 100:
                    left.append(s)
        m["showtimes"] = left
    return p


def cap(cinema: str, keep: int) -> dict:
    """A copy of the data with at most `keep` of one cinema's screenings."""
    p = copy.deepcopy(REAL)
    n = 0
    for m in p["movies"]:
        left = []
        for s in m["showtimes"]:
            if s["cinema"] != cinema:
                left.append(s)
            else:
                n += 1
                if n <= keep:
                    left.append(s)
        m["showtimes"] = left
    return p


def blank(field: str, value=None) -> dict:
    p = copy.deepcopy(REAL)
    for m in p["movies"]:
        if field == "booking_url":
            for s in m["showtimes"]:
                s["booking_url"] = ""
        else:
            m[field] = value
    return p


print(f"fixture: {TODAY}, {len(REAL['movies'])} films, "
      f"{sum(_counts.values())} screenings, biggest = {BIG}\n")

# --- must stay quiet -------------------------------------------------------
case("an identical scrape", REAL, False)
case("no previous file (first ever run)", REAL, False, old=None)

# The ordinary case, and the one a naive total-count check gets wrong: cinemas
# publish a Do-Mi week, so yesterday's file always covers one day more than
# today's. That is not a regression.
older = copy.deepcopy(REAL)
for m in older["movies"]:
    m["showtimes"] = [s for s in m["showtimes"] if s["datetime"][:10] > TODAY]
case("one day rolled off the horizon", older, False)

case(f"{BIG} loses 20% (cancellations)", thin(BIG, keep=0.8), False)
# A source under the guard's baseline may vanish without a word. Which house is
# the smallest changes with the programme, and it is not necessarily *below* the
# baseline: on 2026-08-15 the smallest had exactly MIN_BASELINE screenings, the
# guard rightly fired, and this case failed the daily run. So the fixture puts
# the cinema under the line itself instead of hoping one of them is.
case(f"{TINY} vanishes (below the baseline)", thin(TINY), False,
     old=cap(TINY, guard.MIN_BASELINE - 1))

# --- must fire -------------------------------------------------------------
case(f"{BIG}'s scraper dies", thin(BIG), True)
case(f"{BIG2} loses 70%", thin(BIG2, keep=0.3), True)
case("TMDB key expired (no posters)", blank("poster"), True)
case("OMDb key expired (no ratings)",
     blank("ratings", {"imdb": None, "metascore": None, "letterboxd": None}), True)
case("the ticket-link builder broke", blank("booking_url"), True)

half = copy.deepcopy(REAL)
for m in half["movies"][::2]:
    m["showtimes"] = []
case("half the programme gone", half, True)

print(f"\n{'ALL GOOD' if not failures else str(failures) + ' FAILED'}")
sys.exit(1 if failures else 0)
