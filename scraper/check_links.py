"""Verify that ticket links land on a page where you can actually buy.

Twice now a link looked right in the data and was useless in a browser — the
kinoheld per-show route with the wrong id space (fixed 2026-08-02), then its
iframe wrapper rendering a blank cinema page (same day). Both would have been
caught by fetching the link and looking for the film on the page, which is what
this does.

It samples screenings per cinema rather than checking all ~1 400 — one request
per link, and the point is to catch a broken *pattern*, which shows up in the
first sample. Per host we know what a real booking page contains:

    python check_links.py                # sample 3 per cinema
    python check_links.py --per 8        # more samples
    python check_links.py --cinema Woki  # one cinema, all of its links
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
from collections import defaultdict

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data", "movies.json")
HEADERS = {"User-Agent": "Mozilla/5.0 (kinoguide-koeln; personal project)",
           "Accept-Language": "de"}

# What proves a page is the booking step for one screening, per ticket system.
# A page that merely loads is not enough: the blank-page bug returned HTTP 200.
MARKERS = {
    "www.kinoheld.de": ["sitzplatzwahl", "zur kasse", "ticketauswahl"],
    "shop.cinedom.de": ["seatingplan", "vorstellung", "tickets"],
    "www.kinopolis.de": ["vorstellung", "ticket"],
    "booking.cinetixx.de": ["cinetixx", "vorstellung", "ticket"],
    "tickets.cineplex.de": ["checkout", "ticket", "vorstellung"],
    "webticketing3.cinestar.de": ["cinestar", "ticket", "vorstellung"],
    "kinotickets.express": ["ticket", "vorstellung", "buchung"],
    "koeln.premiumkino.de": ["vorstellung", "ticket", "residenz"],
    "t.rausgegangen.de": ["ticket", "veranstaltung"],
    # info-only venues: their own event page, not a shop
    "www.bonnerkinemathek.de": ["kinemathek"],
    "www.internationale-stummfilmtage.de": ["stummfilmtage", "arkadenhof"],
}
# a page that says one of these is an error, whatever its status code.
# Scanned against the markup only *after* scripts are stripped: these pages
# embed their whole i18n string table as JSON, so a raw search finds
# "Leider gibt es derzeit keine Vorstellungen." on every working page too.
BAD = ["nicht gefunden", "500 - errors", "seite existiert nicht",
       "page not found"]
_SCRIPTS = re.compile(r"<script.*?</script>", re.S | re.I)

# Hosts a script cannot judge. Not a free pass — a 4xx/5xx still fails above;
# we just cannot assert on their body.
UNVERIFIABLE = {
    # answers 403 to every non-browser agent (same reason their prices are
    # typed in by hand — see web/src/prices.js)
    "tickets.cineplex.de": "403s non-browser agents",
    # single-page shop: the seat plan is drawn by JS, the HTML says nothing
    "shop.cinedom.de": "SPA, empty HTML",
    "www.kinopolis.de": "SPA, empty HTML",
    "booking.cinetixx.de": "SPA, empty HTML",
    "webticketing3.cinestar.de": "SPA, empty HTML",
}


def host_of(url: str) -> str:
    return re.sub(r"^https?://", "", url).split("/")[0]


def check(url: str, title: str) -> tuple[bool, str]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
    except Exception as e:
        return False, f"request failed: {e}"
    raw = re.sub(r"\s+", " ", r.text)
    text = _SCRIPTS.sub(" ", raw).lower()
    blocked = host_of(url) in UNVERIFIABLE
    # a bot-block is not a broken link; a 404 still is, for anyone
    if blocked and r.status_code in (401, 403, 405, 429):
        return True, f"ok (blocked from checking: HTTP {r.status_code})"
    if r.status_code >= 400:
        return False, f"HTTP {r.status_code}"
    for bad in BAD:
        if bad in text:
            return False, f"error page ({bad!r})"
    if blocked:
        return True, f"ok (not script-checkable: {UNVERIFIABLE[host_of(url)]})"
    markers = MARKERS.get(host_of(url))
    if markers and not any(m in text for m in markers):
        return False, "no booking markers on the page"
    # the film's own name is the strongest signal; short titles give false
    # positives, so it only counts as a bonus, never as a failure on its own
    word = max(re.findall(r"[a-zäöüß]{5,}", title.lower()) or [""], key=len)
    return True, "ok" + ("" if not word or word in text else " (title not on page)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per", type=int, default=3, help="samples per cinema")
    ap.add_argument("--cinema", help="only this cinema, every link")
    args = ap.parse_args()

    with open(DATA, encoding="utf-8") as f:
        data = json.load(f)

    per_cinema = defaultdict(list)
    for movie in data["movies"]:
        for show in movie["showtimes"]:
            per_cinema[show["cinema"]].append((show, movie))

    random.seed(0)  # same sample every run, so a failure is reproducible
    failures = 0
    for cinema in sorted(per_cinema):
        if args.cinema and args.cinema.lower() not in cinema.lower():
            continue
        rows = per_cinema[cinema]
        picks = rows if args.cinema else random.sample(rows, min(args.per, len(rows)))
        for show, movie in picks:
            url = show.get("booking_url") or ""
            if not url:
                print(f"  FAIL {cinema}: no link at all ({movie['title_de']})")
                failures += 1
                continue
            ok, why = check(url, movie["title_de"])
            if not ok or "title not on page" in why:
                print(f"  {'FAIL' if not ok else 'warn'} {cinema} · "
                      f"{movie['title_de'][:28]} {show['datetime'][:16]}\n"
                      f"       {why}\n       {url}")
                failures += not ok
        print(f"  ok   {cinema} ({len(picks)} checked)")

    print("\nall ticket links reachable" if not failures
          else f"\n{failures} broken link(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
