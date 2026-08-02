"""CineOrder ticket shops: the program, and the exact price of every screening.

CineOrder (Compeso) is the till behind several of our cinemas. Every one of
those shops answers the same call with its whole program *including every price
category of every screening*:

    GET <shop>/api/films?locale=de&include.pricecategories=true
    Header: CENTER-OID: <the cinema's id>

That header is the entire authorization — without it every /api/… call answers
401; with it, no session, token or cookie is needed. One request per cinema per
day, a few hundred KB gzipped, lighter than one visitor browsing the program.
We send an identifying User-Agent. Their robots.txt allows generic agents
(`use=reference`) and disallows AI-training crawlers, which we are not.

Two cinemas use it so far, and they are *different shops* — hence the per-cinema
`cineorder_api` in cinemas.json:

    Kinopolis Bad Godesberg   iframe.ts.kinopolis.de   20000000014VEGOZTB
    Cinedom                   shop.cinedom.de          9DD10000014AKQLNRG

Why bother: these prices are the ground truth our hand-curated table in
web/src/prices.js can only approximate. They already include
  * the per-film surcharge (the "filmbezogener Zuschlag" / "Blockbuster-
    zuschlag", 0 … 2,50 €) that nothing we scrape could otherwise predict,
  * the format (a 3D Atmos screening of a kids' film is many euros dearer for
    a family than the plain 2D one an hour earlier),
  * event pricing (opera relays, KINOFEST, Late Night, Best of Cinema),
  * the real combi-menu prices,
and the family price is simply *present* on the screenings where the cinema
grants it — so its time window and FSK rules need no guessing at all.

`priceIncludesAdvanceSaleFee` is true at both shops: these are the totals a
visitor pays online, with no booking fee to add. Verified by hand at Cinedom on
2026-07-30 — Toy Story 5 (Atmos) Fr 31.07. 13:40 rang up Erwachsener 10,00 €,
Kind/Fam 8,00 €, and Die Odyssee Fr 31.07. 20:15 Erwachsener 13,50 €, Kind
10,50 €, exactly what this module derives for those two performance ids.

Screenings are matched to ours by the performance id their booking URLs already
carry (…/vorstellung/<id> at Kinopolis, ?performance=<id> at Cinedom).

Caveat: this is an internal API and may change without notice. Everything here
is best-effort — main.py isolates the call, keeps the last good prices.json, and
the frontend falls back to the curated price table.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

import requests

from language import classify

DEFAULT_API = "https://iframe.ts.kinopolis.de/api/films"
HEADERS = {
    "User-Agent": "kinoguide-koeln/1.0 (+https://kinoguide.github.io)",
    "Accept": "application/json",
}

# one response per shop per run, shared between showtimes and prices
_program_cache: dict[tuple[str, str], list[dict]] = {}


def fetch_program(center_oid: str, api: str = DEFAULT_API, timeout: int = 45) -> list[dict]:
    """The cinema's whole program: one entry per film, each with performances.

    Cached, so asking for showtimes and prices in the same run stays one request.
    """
    key = (api, center_oid)
    if key not in _program_cache:
        resp = requests.get(
            api,
            params={"locale": "de", "include.pricecategories": "true"},
            headers={**HEADERS, "CENTER-OID": center_oid},
            timeout=timeout,
        )
        resp.raise_for_status()
        _program_cache[key] = resp.json()
    return _program_cache[key]


# The standard seat — the one a family actually books — is seating area 1 at
# both shops, and it is also the cheapest. Verified against the rendered seat
# plans: Kinopolis 1 = Komfort, Cinedom 1 = Parkett (2 = Loge, 3 = VIP).
STANDARD_AREA = 1

# Their category names → the roles our price panel prices people in. Names differ
# per shop, so this is the union of both; a name means the same thing wherever it
# appears. A category anyone may buy (a cheap *screening* rather than a cheap
# visitor) counts for every role and lives in ANY_NAMES. Unlisted categories are
# ignored on purpose: menus are handled below, and the wine/beer deals are not
# ticket prices for a family.
ROLE_NAMES = {
    "adult": ("Normal", "Normal Oper", "Best of Cinema Ticket",   # Kinopolis
              "Erwachsener"),                                     # Cinedom
    "child": ("Kind unter 12 J.", "Kind",                         # Kinopolis
              "Kind (bis 11 J.)"),                                # Cinedom
    "reduced": ("Ermäßigt", "Best of Cinema Schüler/Student"),    # Kinopolis only
    # The adult half of a family ticket: what the *grown-ups* pay when they bring
    # a child. Cinedom splits it in two ("Fam Erw" / "Fam Kind"), but the two are
    # the same number on every screening in the program — checked over all 56
    # that offer it on 2026-07-30 — so one value still describes the offer.
    "family": ("Familienpreis",                                   # Kinopolis
               "Fam Erw", "Fam. Erw."),                           # Cinedom
}
ANY_NAMES = ("KINOFEST", "Late Night", "Sneak")

# Ticket + food bundles worth showing a family, as "role" → category name
MENU_NAMES = {
    "menu_child": "Super Deal Kindermenü",
    "menu_family": "Super Deal Familienmenü",
    "menu_holiday": "Schüler Ferienkino",
}


def _standard_price(category: dict) -> float | None:
    """The standard-seat price of one category (falling back to its first area)."""
    areas = category.get("seatingAreas") or []
    area = next((a for a in areas if a.get("id") == STANDARD_AREA), None) or (areas[0] if areas else None)
    try:
        return float(area["price"]["price"])
    except (KeyError, TypeError, ValueError):
        return None


def _prices_for(performance: dict) -> dict:
    """Cheapest price per role for one screening, plus format info."""
    by_name: dict[str, float] = {}
    for cat in performance.get("priceCategories") or []:
        price = _standard_price(cat)
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


def fetch_prices(center_oid: str, api: str = DEFAULT_API, timeout: int = 45) -> dict[str, dict]:
    """{performance id: prices} for every screening the shop currently sells."""
    shows: dict[str, dict] = {}
    for film in fetch_program(center_oid, api=api, timeout=timeout):
        for perf in film.get("performances") or []:
            pid = perf.get("id")
            prices = _prices_for(perf) if pid else {}
            # a screening with no usable ticket price tells us nothing
            if pid and any(k in prices for k in ROLE_NAMES):
                shows[pid] = prices
    return shows


# The two shops carry the performance id differently: Kinopolis in the path
# (…/vorstellung/<id>), Cinedom in a query parameter (…?performance=<id>) that
# reaches us through kinoheld's deeplink. Same key, two shapes — prices.js
# showId() matches the same pair on the frontend side.
# The 16-character floor matters: kinoheld's own /vorstellung/<urlSlug> links
# carry a short numeric slug (50892), and those must not be read as shop ids.
_PERFORMANCE_RE = re.compile(r"(?:[?&]performance=|/vorstellung/)([A-Z0-9]{16,})")


def performance_id(url: str) -> str | None:
    m = _PERFORMANCE_RE.search(url or "")
    return m.group(1) if m else None


def apply_languages(shows: list[dict], cinema: dict) -> int:
    """Relabel OV/OmU from the shop's own per-screening `releaseTypeName`.

    For a cinema whose *showtimes* come from elsewhere but whose booking links
    already point at its CineOrder shop (Cinedom: kinoheld hands out
    `…?performance=<id>` deeplinks), the shop still knows the version of every
    screening it sells — and kinoheld mostly doesn't.

    Measured on Cinedom, 2026-07-30, over the 313 screenings both describe:
    the shop marks 48 as OV or OmU that reach us from kinoheld unmarked, with
    no flag of any kind to reveal them — Die Odyssee OV, the nightly
    Spider-Man OV and 3D/OV, Obsession OV, Toy Story 5 OV. In the other
    direction the shop contradicts nothing once the "BEST OF CINEMA" false
    positives are out of the classifier (see language.OV_PATTERNS), so this is
    a strict superset, exactly as the same field proved for Kinopolis.

    Screenings the shop no longer sells (today's, once the sale closes) simply
    keep their existing label. Mutates in place; returns how many changed.
    """
    oid = cinema.get("cineorder_center_oid")
    if not oid:
        return 0
    by_id = {}
    for film in fetch_program(oid, api=cinema.get("cineorder_api") or DEFAULT_API):
        for perf in film.get("performances") or []:
            if perf.get("id"):
                by_id[perf["id"]] = perf.get("releaseTypeName") or ""

    changed = 0
    for show in shows:
        pid = performance_id(show.get("booking_url") or "")
        if not pid or pid not in by_id:
            continue
        lang = classify(by_id[pid])
        if lang != show.get("language"):
            show["language"] = lang
            changed += 1
    return changed


def collect(cinemas: list[dict]) -> dict:
    """Price payload for every cinema in cinemas.json that names a CENTER-OID."""
    out: dict[str, dict] = {}
    for cinema in cinemas:
        oid = cinema.get("cineorder_center_oid")
        if not oid:
            continue
        print(f"Fetching prices for {cinema['name']}…")
        try:
            shows = fetch_prices(oid, api=cinema.get("cineorder_api") or DEFAULT_API)
        except Exception as e:  # never let prices break the run
            print(f"  [error] prices for {cinema['name']}: {e}")
            continue
        print(f"  {len(shows)} screenings priced")
        entry = {
            "source": cinema.get("price_page") or cinema.get("website"),
            # what the shop charges: list price + this film's surcharge, and
            # no booking fee on top — these are the totals a visitor pays
            "fee_included": True,
            "shows": shows,
        }
        # How many grown-ups the family price covers. Cinedom caps it at two
        # ("in Begleitung von mindestens einem, maximal zwei, Erwachsenen");
        # Kinopolis names no limit, so it stays absent = uncapped.
        if cinema.get("family_max_adults"):
            entry["family_max_adults"] = cinema["family_max_adults"]
        out[cinema["name"]] = entry
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "cinemas": out}
