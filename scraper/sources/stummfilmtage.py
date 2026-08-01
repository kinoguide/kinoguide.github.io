"""The Internationale Stummfilmtage — Bonn's open-air silent film festival.

Ten nights in August in the Arkadenhof of Bonn University, restored silent films
with live music. It is the one venue in either city where "buy a ticket" is not
a thing at all: **admission is free**, doors at 19:00, seats first come first
served, donations welcome. So there is nothing to book and no price to quote —
the cinema entry carries `ticketing: "info"` and the frontend links to the
festival's own page for each film instead of a ticket shop.

Their site is Webflow, and the programme is a tab per festival day:

    menu:  <a data-w-tab="Tab 1" class="… w-tab-link">13do</a>      day + weekday
    pane:  <div data-w-tab="Tab 1" class="w-tab-pane">
             <a href="/filmsammlung/gosta-berlings-saga-de" …>
               <div class="cms-datum">21:15</div>
               <h3 class="cms-headline">Gösta Berling Teil 1</h3>
               <div class="cms-text">Schweden 1924, 106 Min.</div>   country + year
               <div class="cms-text">Mauritz Stiller</div>           director
               <div class="cms-text">Daan van den Hurk (Flügel)</div> live musician

The tab labels carry only a day number, so the month and year come from the
festival dates in the page heading ("13.– 22. AUG 2026"). That pairing is then
**verified against the weekday in each label** — if 13 August is not a Thursday,
the page has moved on to a layout we no longer understand and we return nothing
rather than a programme on the wrong dates.

Debug helper:
  python -m sources.stummfilmtage
"""
from __future__ import annotations

import html
import re
from datetime import datetime, timedelta, timezone

import requests

from language import classify

SITE = "https://www.internationale-stummfilmtage.de"
HEADERS = {"User-Agent": "Mozilla/5.0 (kinoguide-koeln; personal project; "
                        "+https://kinoguide.github.io)"}

MONTHS = {"jan": 1, "feb": 2, "mär": 3, "mar": 3, "apr": 4, "mai": 5, "jun": 6,
          "jul": 7, "aug": 8, "sep": 9, "okt": 10, "nov": 11, "dez": 12}
WEEKDAYS = {"mo": 0, "di": 1, "mi": 2, "do": 3, "fr": 4, "sa": 5, "so": 6}

# "13.– 22. AUG 2026" — the festival's own date line, in whatever spacing
_RANGE = re.compile(r"(\d{1,2})\.\s*[–—-]\s*(\d{1,2})\.\s*"
                    r"(jan|feb|mär|mar|apr|mai|jun|jul|aug|sep|okt|nov|dez)[a-zä]*\.?\s*(\d{4})",
                    re.I)
_TAB_LINK = re.compile(r'data-w-tab="(Tab \d+)"[^>]*class="[^"]*w-tab-link[^"]*"[^>]*>(.*?)</a>', re.S)
_TAB_LABEL = re.compile(r"(\d{1,2})\s*(mo|di|mi|do|fr|sa|so)", re.I)
# the *open* pane's class starts with its own name ("tab-pane-tab-1 w-tab-pane
# w--tab-active"), so match w-tab-pane anywhere in the attribute — anchoring it
# at the front silently dropped the festival's first day
_PANE = re.compile(r'<div data-w-tab="(Tab \d+)" class="[^"]*w-tab-pane[^"]*"(.*?)(?=<div data-w-tab="Tab |\Z)', re.S)
# side events (workshops, book launches) share the layout; the festival prints a
# production year for every actual film, so that is what tells the two apart
_SIDE = re.compile(r"^rahmenprogramm\s*:\s*", re.I)
_ITEM = re.compile(r'href="(/filmsammlung/[^"]+)"(.*?)(?=href="/filmsammlung/|\Z)', re.S)
_TIME = re.compile(r'class="cms-datum">\s*([0-2]?\d:[0-5]\d)')
_TITLE = re.compile(r'class="cms-headline">(.*?)</h3>', re.S)
_META = re.compile(r'class="cms-text">(.*?)</div>', re.S)
_YEAR = re.compile(r"\b(1[89]\d{2}|20\d{2})\b")
_TAG = re.compile(r"<[^>]+>")


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(_TAG.sub("", text))).strip()


def _last_sunday(year: int, month: int) -> datetime:
    d = datetime(year, month + 1, 1) if month < 12 else datetime(year + 1, 1, 1)
    d -= timedelta(days=1)
    return d - timedelta(days=(d.weekday() + 1) % 7)


def _berlin_offset(local: datetime) -> timezone:
    """CEST/CET without a timezone database — see sources/kinemathek.py."""
    start = _last_sunday(local.year, 3) + timedelta(hours=2)
    end = _last_sunday(local.year, 10) + timedelta(hours=3)
    return timezone(timedelta(hours=2 if start <= local < end else 1))


def fetch_shows(cinema: dict) -> list[dict]:
    html_text = requests.get(cinema.get("url") or SITE, headers=HEADERS, timeout=30).text
    plain = _clean(html_text)

    m = _RANGE.search(plain)
    if not m:
        raise ValueError("festival dates not found on the page")
    first_day, _last_day, month_name, year = m.groups()
    month, year = MONTHS[month_name.lower()[:3]], int(year)

    # tab -> date, from the day number in each tab's label
    dates: dict[str, datetime] = {}
    for tab, label in _TAB_LINK.findall(html_text):
        lm = _TAB_LABEL.search(_clean(label))
        if not lm:
            continue
        day, weekday = int(lm.group(1)), WEEKDAYS[lm.group(2).lower()]
        # a festival can run over a month boundary: a day number below the
        # opening day belongs to the next month
        d_month, d_year = month, year
        if day < int(first_day):
            d_month, d_year = (1, year + 1) if month == 12 else (month + 1, year)
        date = datetime(d_year, d_month, day)
        if date.weekday() != weekday:
            raise ValueError(f"{date:%d.%m.%Y} is not a {lm.group(2)} — layout changed?")
        dates[tab] = date

    shows = []
    for tab, pane in _PANE.findall(html_text):
        date = dates.get(tab)
        if not date:
            continue
        for href, block in _ITEM.findall(pane):
            time_m, title_m = _TIME.search(block), _TITLE.search(block)
            if not (time_m and title_m):
                continue
            title = _clean(title_m.group(1))
            hour, minute = (int(x) for x in time_m.group(1).split(":"))
            local = date.replace(hour=hour, minute=minute)
            meta = " ".join(_clean(x) for x in _META.findall(block)[:1])
            years = sorted({int(y) for y in _YEAR.findall(meta)})
            shows.append({
                "title": _SIDE.sub("", title),
                "datetime": local.replace(tzinfo=_berlin_offset(local)).isoformat(),
                "language": classify(title),
                "booking_url": SITE + href,
                "years": years,
                "is_film": bool(years),
            })
    return shows


if __name__ == "__main__":  # pragma: no cover - debug helper
    for s in fetch_shows({"name": "Stummfilmtage"}):
        print(f"{s['datetime'][:16]}  {s['title'][:44]:<46}{s['years']}  {s['booking_url']}")
