"""Assert every cinema address is a real Köln or Bonn venue address.

    cd scraper && python check_addresses.py

Run it after touching an address in cinemas.json. Two things go wrong with
cinema addresses, and both look perfectly fine in the data:

  * **The operator's seat instead of the cinema's.** Metropolis and Rex am Ring
    both print their operator's Wuppertal address in the Impressum and the
    cinema's own under a separate "Adresse Kino". Taking the obvious one puts
    two Köln houses 50 km away.
  * **The programmer's office instead of the venue.** The Bonner Kinemathek
    programmes two open-airs; its own address is in Beuel, while the films play
    on the Bundeskunsthalle roof and at the Friesdorf lido. What matters is
    where the film is shown, because that is where people are going.

So this checks the postcode is inside one of the two cities, and that the
coordinates (used only for "nearest first") agree with the address to within a
few hundred metres — a coordinate that has drifted off its street is how a
"nearest" list starts lying. Geocoding is a network call, so `--offline` skips
just that part.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time

import requests

HERE = os.path.dirname(os.path.abspath(__file__))

# Köln 50667–51149, Bonn 53111–53229. Anything else is not one of our two
# cities — including the 42xxx that a Wuppertal operator address would carry.
CITY_RANGES = {"Köln": (50667, 51149), "Bonn": (53111, 53229)}

# how far the geocoder may land from the stored coordinate, in km
MAX_DRIFT = 0.4

UA = {"User-Agent": "kinoguide-koeln/1.0 (+https://kinoguide.github.io) address check"}


def haversine(a: tuple[float, float], b: tuple[float, float]) -> float:
    from math import asin, cos, radians, sin, sqrt
    dlat, dlon = radians(b[0] - a[0]), radians(b[1] - a[1])
    h = sin(dlat / 2) ** 2 + cos(radians(a[0])) * cos(radians(b[0])) * sin(dlon / 2) ** 2
    return 6371 * 2 * asin(sqrt(h))


def _one(query: str) -> tuple[float, float] | None:
    r = requests.get("https://nominatim.openstreetmap.org/search",
                     params={"q": f"{query}, Germany", "format": "json", "limit": 1},
                     headers=UA, timeout=30)
    hits = r.json() if r.status_code == 200 else []
    return (float(hits[0]["lat"]), float(hits[0]["lon"])) if hits else None


def geocode(address: str) -> tuple[float, float] | None:
    """Some of ours name the venue first ("Freibad Friesdorf, Margaretenstraße
    14, …") because that is what a visitor is looking for. The geocoder takes
    most of those but not all — "Arkadenhof der Universität" draws a blank — so
    a miss retries on the street part alone before giving up."""
    hit = _one(address)
    if hit is None and "," in address:
        time.sleep(1.2)
        hit = _one(address.split(",", 1)[1].strip())
    return hit


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true",
                    help="skip the geocoder, check only the addresses themselves")
    args = ap.parse_args()

    with open(os.path.join(HERE, "cinemas.json"), encoding="utf-8") as f:
        cinemas = json.load(f)["cinemas"]

    problems: list[str] = []
    for c in cinemas:
        name, city = c["name"], c.get("city")
        addr, lat, lon = c.get("address"), c.get("lat"), c.get("lon")

        if not addr:
            problems.append(f"{name}: no address")
            continue
        if lat is None or lon is None:
            problems.append(f"{name}: no coordinates")
            continue

        m = re.search(r"\b(\d{5})\b", addr)
        if not m:
            problems.append(f"{name}: no postcode in {addr!r}")
            continue
        code = int(m.group(1))
        lo, hi = CITY_RANGES.get(city, (0, 0))
        if not lo <= code <= hi:
            problems.append(
                f"{name}: postcode {code} is not in {city} ({lo}-{hi}) — {addr!r}. "
                f"An operator's registered office rather than the cinema?")
            continue
        # the address must name the city it is filed under
        if city.lower() not in addr.lower():
            problems.append(f"{name}: address does not name {city} — {addr!r}")
        # a street needs a number; "Bundeskunsthalle, Helmut-Kohl-Allee 4" has one
        if not re.search(r"\d+\s*(-\s*\d+)?\s*,", addr + ","):
            problems.append(f"{name}: no house number in {addr!r}")

    if not args.offline:
        for c in cinemas:
            if not c.get("address") or c.get("lat") is None:
                continue
            found = geocode(c["address"])
            time.sleep(1.2)                      # Nominatim asks for 1 req/s
            if not found:
                print(f"  [warn] {c['name']}: geocoder found nothing for "
                      f"{c['address']!r} — checked by hand?")
                continue
            drift = haversine((c["lat"], c["lon"]), found)
            mark = "ok  " if drift <= MAX_DRIFT else "DRIFT"
            print(f"  {mark} {c['name'][:32]:34} {drift * 1000:6.0f} m")
            if drift > MAX_DRIFT:
                problems.append(
                    f"{c['name']}: stored coordinate is {drift:.1f} km from where "
                    f"{c['address']!r} geocodes to")

    if problems:
        print("\nADDRESS PROBLEMS:")
        for p in problems:
            try:
                print(f"  * {p}")
            except UnicodeEncodeError:
                print("  * " + p.encode("ascii", "replace").decode("ascii"))
        return 1
    print(f"\nall {len(cinemas)} addresses are Köln/Bonn venue addresses")
    return 0


if __name__ == "__main__":
    sys.exit(main())
