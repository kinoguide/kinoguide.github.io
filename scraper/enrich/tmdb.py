"""Resolve a (German) movie title to TMDB metadata + IMDb ID.

Get a free API key at https://www.themoviedb.org/settings/api and export it
as TMDB_API_KEY.
"""
from __future__ import annotations

import os
import requests

API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p/w342"


def _key() -> str:
    key = os.environ.get("TMDB_API_KEY", "")
    if not key:
        raise RuntimeError("TMDB_API_KEY is not set")
    return key


def lookup(title: str, year: int | None = None) -> dict | None:
    """Search TMDB with a German title, return metadata dict or None."""
    params = {"api_key": _key(), "query": title, "language": "de-DE"}
    if year:
        params["year"] = year
    r = requests.get(f"{API}/search/movie", params=params, timeout=30)
    r.raise_for_status()
    results = r.json().get("results", [])
    if not results:
        return None

    best = results[0]
    detail = requests.get(
        f"{API}/movie/{best['id']}",
        params={"api_key": _key(), "language": "de-DE",
                "append_to_response": "external_ids,release_dates,videos",
                "include_video_language": "de,en,null"},
        timeout=30,
    ).json()

    # German overview is missing for smaller/documentary titles — fall back
    # to the English one rather than showing nothing.
    overview = (detail.get("overview") or "").strip()
    if not overview:
        en = requests.get(f"{API}/movie/{best['id']}",
                          params={"api_key": _key(), "language": "en-US"},
                          timeout=30).json()
        overview = (en.get("overview") or "").strip()

    return {
        "tmdb_id": best["id"],
        "imdb_id": detail.get("external_ids", {}).get("imdb_id"),
        "title_de": detail.get("title") or title,
        "title_original": detail.get("original_title") or title,
        "year": int((detail.get("release_date") or "0000")[:4]) or None,
        "runtime": detail.get("runtime"),
        "poster": IMG + detail["poster_path"] if detail.get("poster_path") else None,
        "genres": [g["name"] for g in detail.get("genres", []) if g.get("name")],
        "age_rating": _fsk(detail),
        "overview": overview or None,
        "trailer": _trailer(detail),
    }


def _trailer(detail: dict) -> str | None:
    """Best YouTube trailer URL: prefer official trailers, German over English."""
    videos = [v for v in (detail.get("videos") or {}).get("results", [])
              if v.get("site") == "YouTube" and v.get("key")]
    if not videos:
        return None

    def score(v):
        return (
            v.get("type") == "Trailer",
            bool(v.get("official")),
            v.get("iso_639_1") == "de",
            v.get("iso_639_1") == "en",
        )

    best = max(videos, key=score)
    if best.get("type") not in ("Trailer", "Teaser"):
        return None
    return f"https://www.youtube.com/watch?v={best['key']}"


def _fsk(detail: dict) -> int | None:
    """Extract the German FSK age rating (0/6/12/16/18) from release_dates.

    TMDB nests it as release_dates.results[iso_3166_1='DE'].release_dates[].certification.
    Returns the numeric minimum age, or None if TMDB has no DE certification.
    """
    for country in (detail.get("release_dates") or {}).get("results", []):
        if country.get("iso_3166_1") != "DE":
            continue
        for rel in country.get("release_dates", []):
            cert = (rel.get("certification") or "").strip()
            if cert.isdigit():
                return int(cert)
    return None
