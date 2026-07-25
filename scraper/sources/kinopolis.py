"""Showtimes for Kinopolis, straight from their own ticket shop.

Kinopolis used to come to us via kinoheld like most cinemas. It doesn't any
more, because kinoheld's copy of their program is both incomplete and, in a
few places, wrong. Measured against the cinema's own shop on 2026-07-25:

  * 10 screenings missing — almost all of them *newly announced* films that
    are already on advance sale (Detektiv Conan 29, Cars 20th Anniversary,
    the Zauberhafte-Schwestern-2 preview, the three Herr-der-Ringe Extended
    dates, two Hindi OmU nights). Exactly the arrivals a guide exists to show.
  * 2 screenings filed under the wrong film: Sa 25.07. and Mo 27.07. 16:00
    were sold as "Was haben wir gelacht" but reached us as "Supergirl", with
    kinoheld naming "Supergirl" at entry, movie *and* show level — nothing in
    the feed could have revealed it.
  * 2 more where kinoheld's per-show name was right but its movie entry was
    not ("25 Jahre Shrek" filed under "25 Jahre radioeins in der Waldbühne",
    "Verdi: Macbeth" under "Sang Blanc (Macbeth)").

The shop has none of these problems — it *is* the till the tickets are sold
from — and we already download it once a day for prices, so this costs no
extra request: fetch_program() caches the response and sources.kinopolis_prices
reads prices out of the very same payload. See that module for the endpoint,
the CENTER-OID header that authorizes it, and the robots.txt situation.

Per screening the shop gives us:
    id                    the performance id our booking links already use,
                          and the join key for data/prices.json
    performanceDateTime   ISO 8601, with the correct local offset
    filmTitle             the film *this* screening actually sells tickets for
    releaseTypeName       "Digital" / "3D Atmos D-BOX" / "OV" / "OmU Spezial" …

That last field replaces the data-version scrape of their program page
(custom.apply_kinopolis_languages). Cross-checked over the whole program: of
the 32 screenings the page marks OV/OmU, the shop agrees on all 32 — and it
marks 34 further ones the page simply can't, because the page only renders the
next two weeks while the shop sells into 2027. Strictly more, never contrary.

kinoheld stays configured as a fallback: if the shop call fails we still get a
program for the day, just the older, thinner one (with the page-based language
correction applied, as before).

Debug helper:
    python -m sources.kinopolis          # fetch + normalize Bad Godesberg
"""
from __future__ import annotations

import json
import re
import sys

import requests

from language import classify
from sources import kinoheld, custom

API = "https://iframe.ts.kinopolis.de/api/films"
HEADERS = {
    "User-Agent": "kinoguide-koeln/1.0 (+https://kinoguide.github.io)",
    "Accept": "application/json",
}

# one response per cinema per run, shared with sources.kinopolis_prices
_program_cache: dict[str, list[dict]] = {}


def fetch_program(center_oid: str, timeout: int = 45) -> list[dict]:
    """The cinema's whole program: one entry per film, each with performances.

    ~300 KB gzipped. Cached, so asking for showtimes and prices in the same
    run is still a single request.
    """
    if center_oid not in _program_cache:
        resp = requests.get(
            API,
            params={"locale": "de", "include.pricecategories": "true"},
            headers={**HEADERS, "CENTER-OID": center_oid},
            timeout=timeout,
        )
        resp.raise_for_status()
        _program_cache[center_oid] = resp.json()
    return _program_cache[center_oid]


# Bracketed notes Kinopolis hangs off a title. Every one of them describes the
# *screening* — the series it runs in, an anniversary re-release, the spoken
# language, a black-and-white or extended print — and none is part of the film's
# name, so TMDB matches better once they're gone. Checked against all 77 titles
# in the program on 2026-07-25; nothing else in that list is bracketed.
# ("Extented" is their own typo and is deliberately matched.)
_ANNOTATION_RE = re.compile(
    r"\s*\((?:"
    r"MET live im Kino|Best of Cinema|Ladykino|Sneak|s/w"
    r"|Oper[an] national de Paris|Royal Opera House"
    r"|Ext[ea]n[td]e[dt] Version|Director'?s Cut"
    r"|\d{1,3}\s*(?:th|st|nd|rd)\s*Anniversary"
    r"|arab\.|engl\.|korea\.|japan\.|t[uü]rk\.|ital\.|franz\.|span\."
    r"|Hindi|Tamil|Telugu|Malayalam|Kannada|Punjabi"
    r")\)",
    re.IGNORECASE,
)


def _year(raw) -> int | None:
    """Their productionYear arrives as a string ("2002") — or not at all."""
    try:
        return int(str(raw)[:4])
    except (TypeError, ValueError):
        return None


def _clean(title: str) -> str:
    return re.sub(r"\s{2,}", " ", _ANNOTATION_RE.sub(" ", title)).strip(" -–—:")


def _booking_url(cinema: dict, performance_id: str) -> str:
    """The cinema's own page for exactly this screening.

    Same shape kinoheld's deeplink used, so the performance id stays the join
    key against data/prices.json.
    """
    base = (cinema.get("website") or "").rstrip("/")
    return f"{base}/programm/vorstellung/{performance_id}" if base else ""


def normalize(program: list[dict], cinema: dict) -> list[dict]:
    """Turn the shop payload into [{title, datetime, language, booking_url}]."""
    shows_out = []
    for film in program:
        for perf in film.get("performances") or []:
            pid = perf.get("id")
            begin = perf.get("performanceDateTime")
            # the performance's own filmTitle, not the entry's: it is what the
            # till sells, and the two can disagree (see module docstring)
            title = perf.get("filmTitle") or film.get("title") or ""
            if not (pid and begin and title):
                continue
            # Their productionYear is exact and settles which film a classic
            # re-release is (their "Der Herr der Ringe 2" is the 2002 one, not
            # the 1978 cartoon TMDB ranks first). Its absence is meaningful
            # too: it marks a slot with no film behind it — the Sneak preview,
            # whose whole point is not saying what's playing. Enriching that
            # from TMDB only ever invents a wrong film.
            year = _year(film.get("productionYear"))
            shows_out.append({
                "title": _clean(title),
                "datetime": begin,
                "language": classify(perf.get("releaseTypeName") or ""),
                "booking_url": _booking_url(cinema, pid),
                "year": year,
                "is_film": bool(year),
            })
    return shows_out


def fetch_shows(cinema: dict) -> list[dict]:
    oid = cinema.get("cineorder_center_oid")
    if oid:
        try:
            shows = normalize(fetch_program(oid), cinema)
            if shows:
                return shows
            print(f"  [warn] {cinema['name']}: ticket shop returned an empty program")
        except Exception as e:
            print(f"  [warn] {cinema['name']}: ticket shop unavailable ({e})")
    else:
        print(f"  [warn] {cinema['name']}: no cineorder_center_oid configured")

    print(f"  falling back to kinoheld for {cinema['name']}")
    shows = kinoheld.fetch_shows(cinema)
    # kinoheld carries no language markers for Kinopolis; their program page
    # does, per screening — the correction we relied on before the shop.
    if shows and cinema.get("website"):
        custom.apply_kinopolis_languages(
            shows, cinema["website"].rstrip("/") + "/programm")
    return shows


if __name__ == "__main__":
    oid = sys.argv[1] if len(sys.argv) > 1 else "20000000014VEGOZTB"
    demo = {"name": "Kinopolis Bad Godesberg", "website": "https://www.kinopolis.de/bn",
            "cineorder_center_oid": oid}
    shows = fetch_shows(demo)
    print(json.dumps(shows, indent=2, ensure_ascii=False))
    print(f"\n{len(shows)} shows", file=sys.stderr)
