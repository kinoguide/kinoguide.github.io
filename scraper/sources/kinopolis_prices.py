"""Exact per-screening ticket prices for Kinopolis, from their own ticket shop.

Kinopolis' webshop (CineOrder) hands out the whole program *including every
price category of every screening* in a single call:

    GET https://iframe.ts.kinopolis.de/api/films?locale=de&include.pricecategories=true
    Header: CENTER-OID: <cinema id>     # 20000000014VEGOZTB = Bad Godesberg

That's ~300 KB gzipped, once a day — lighter than one visitor browsing their
program. No session, token or cookie is needed; the header alone is the whole
requirement (without it every /api/… call answers 401). Their robots.txt allows
generic agents (`Allow: /`, content signal `use=reference`) and disallows
AI-training crawlers, which we are not; we send an identifying User-Agent.

Why bother: these prices are the ground truth our hand-curated table in
web/src/prices.js can only approximate. They already include
  * the 0,50 € online advance-sale fee,
  * film-related surcharges (e.g. +1,50 € for an overlength film),
  * the format (a 3D D-BOX screening of a kids' film is ~15 € dearer for a
    family of five than the 2D one an hour earlier),
  * event pricing ("Normal Oper" 20–36 €, KINOFEST 5 €, Late Night, the Monday
    "Best of Cinema" classics),
  * and the real combi-menu prices,
and the Familienpreis is simply *present* on the screenings where the cinema
grants it — so nothing has to be inferred from FSK ratings or the clock.

Screenings are matched to ours by the performance id that their booking URLs
already carry (…/programm/vorstellung/<id>).

Caveat: this is an internal API and may change without notice. Everything here
is best-effort — main.py isolates the call, and the frontend falls back to the
curated price table for any screening we can't match.
"""
from __future__ import annotations

from datetime import datetime, timezone

import requests

API = "https://iframe.ts.kinopolis.de/api/films"
HEADERS = {
    "User-Agent": "kinoguide-koeln/1.0 (+https://kinoguide.github.io)",
    "Accept": "application/json",
}

# Seating areas in their price data: 1 = Komfort (the normal seat), 2 = D-BOX,
# 3 = Premium. Komfort is the price a family actually pays.
KOMFORT_AREA = 1

# Their category names → the roles our price panel prices people in. A category
# that anyone may buy (a cheap screening rather than a cheap visitor) counts for
# every role. Unlisted categories are ignored on purpose: menus are handled
# below, and things like the wine deals aren't ticket prices for a family.
ROLE_NAMES = {
    "adult": ("Normal", "Normal Oper", "Best of Cinema Ticket"),
    "child": ("Kind unter 12 J.", "Kind"),
    "reduced": ("Ermäßigt", "Best of Cinema Schüler/Student"),
    "family": ("Familienpreis",),
}
ANY_NAMES = ("KINOFEST", "Late Night", "Sneak")

# Ticket + food bundles worth showing a family, as "role" → category name
MENU_NAMES = {
    "menu_child": "Super Deal Kindermenü",
    "menu_family": "Super Deal Familienmenü",
    "menu_holiday": "Schüler Ferienkino",
}


def _komfort_price(category: dict) -> float | None:
    """The Komfort-seat price of one category (falling back to its first area)."""
    areas = category.get("seatingAreas") or []
    area = next((a for a in areas if a.get("id") == KOMFORT_AREA), None) or (areas[0] if areas else None)
    try:
        return float(area["price"]["price"])
    except (KeyError, TypeError, ValueError):
        return None


def _prices_for(performance: dict) -> dict:
    """Cheapest price per role for one screening, plus format info."""
    by_name: dict[str, float] = {}
    for cat in performance.get("priceCategories") or []:
        price = _komfort_price(cat)
        name = cat.get("name")
        if price is None or not name:
            continue
        # a name can appear once per screening, but keep the cheapest if not
        by_name[name] = min(price, by_name.get(name, price))

    anyone = [by_name[n] for n in ANY_NAMES if n in by_name]
    out: dict[str, object] = {}
    for role, names in ROLE_NAMES.items():
        options = [by_name[n] for n in names if n in by_name]
        # the family price is tied to bringing a child — never widen it with
        # the open categories, the frontend decides when it applies
        if role != "family":
            options += anyone
        if options:
            out[role] = round(min(options), 2)
    for key, name in MENU_NAMES.items():
        if name in by_name:
            out[key] = round(by_name[name], 2)

    fmt = (performance.get("releaseTypeName") or "").strip()
    if performance.get("is3D") and "3D" not in fmt:
        fmt = f"3D {fmt}".strip()
    # "Digital" is their word for an ordinary 2D screening — not worth a badge
    if fmt and fmt.lower() != "digital":
        out["format"] = fmt
    return out


def fetch_prices(center_oid: str, timeout: int = 45) -> dict[str, dict]:
    """{performance id: prices} for every screening the shop currently sells."""
    r = requests.get(API, params={"locale": "de", "include.pricecategories": "true"},
                     headers={**HEADERS, "CENTER-OID": center_oid}, timeout=timeout)
    r.raise_for_status()
    shows: dict[str, dict] = {}
    for film in r.json():
        for perf in film.get("performances") or []:
            pid = perf.get("id")
            prices = _prices_for(perf) if pid else {}
            # a screening with no usable ticket price tells us nothing
            if pid and any(k in prices for k in ROLE_NAMES):
                shows[pid] = prices
    return shows


def collect(cinemas: list[dict]) -> dict:
    """Price payload for every cinema in cinemas.json that names a CENTER-OID."""
    out: dict[str, dict] = {}
    for cinema in cinemas:
        oid = cinema.get("cineorder_center_oid")
        if not oid:
            continue
        print(f"Fetching prices for {cinema['name']}…")
        try:
            shows = fetch_prices(oid)
        except Exception as e:  # never let prices break the run
            print(f"  [error] prices for {cinema['name']}: {e}")
            continue
        print(f"  {len(shows)} screenings priced")
        out[cinema["name"]] = {
            "source": cinema.get("price_page") or cinema.get("website"),
            "fee_included": True,   # online prices, incl. the advance-sale fee
            "shows": shows,
        }
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "cinemas": out}
