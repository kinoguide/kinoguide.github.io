"""Resolve a (German) movie title to TMDB metadata + IMDb ID.

Get a free API key at https://www.themoviedb.org/settings/api and export it
as TMDB_API_KEY.
"""
from __future__ import annotations

import os
import re
import requests

API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p/w342"


def _key() -> str:
    key = os.environ.get("TMDB_API_KEY", "")
    if not key:
        raise RuntimeError("TMDB_API_KEY is not set")
    return key


def _years(hint) -> set[int]:
    """Normalize a year hint — one year or several — to a set of ints."""
    values = hint if isinstance(hint, (list, tuple, set)) else [hint]
    out = set()
    for v in values:
        try:
            out.add(int(str(v)[:4]))  # sources may hand us "2002" or a date
        except (TypeError, ValueError):
            pass
    return out


def _pick(results: list[dict], hint) -> dict | None:
    """Choose which search hit is the film, preferring the right vintage.

    TMDB's own ranking is usually right, but it goes badly wrong on classics a
    cinema re-releases under a series name: "Der Herr der Ringe 2" ranks the
    1978 animated film above "Die zwei Türme" (2002). When the source told us
    what year(s) the film belongs to, the hit that matches wins.

    If no hit matches we return nothing rather than TMDB's first guess: a film
    of the wrong vintage is a different film, and a card with no poster is
    better than a card with someone else's. That is what keeps the MET's live
    opera relays from borrowing the cover of some other house's recording of
    the same opera. Without a hint we have nothing to check, so TMDB's order
    stands.
    """
    want = _years(hint)
    if not want:
        return results[0]
    for r in results:
        got = (r.get("release_date") or "")[:4]
        if got.isdigit() and any(abs(int(got) - w) <= 1 for w in want):
            return r
    return None


def _has_latin(text: str) -> bool:
    return bool(re.search(r"[A-Za-zÀ-ÿ]", text or ""))


def _de_title(tmdb_title: str | None, scraped: str) -> str:
    """The title to show German visitors: TMDB's, unless it's unreadable here."""
    if tmdb_title and (_has_latin(tmdb_title) or not _has_latin(scraped)):
        return tmdb_title
    return scraped


def lookup(title: str, year=None) -> dict | None:
    """Search TMDB with a German title, return metadata dict or None.

    `year` is what the source knows about the film's vintage — a year, or
    several plausible ones (made in, released in). It is a hint for picking
    between same-named films, not a filter, and is deliberately NOT sent to
    TMDB: their `year` parameter matches the release date, which routinely
    differs from a production year by a year or more (the shop dates "The
    Mandalorian and Grogu" 2025, TMDB releases it 2026), and passing it turns a
    good search into no results at all. We ask broadly and choose in _pick().
    """
    params = {"api_key": _key(), "query": title, "language": "de-DE"}
    r = requests.get(f"{API}/search/movie", params=params, timeout=30)
    r.raise_for_status()
    results = r.json().get("results", [])
    if not results:
        return None

    best = _pick(results, year)
    if not best:
        return None
    detail = requests.get(
        f"{API}/movie/{best['id']}",
        params={"api_key": _key(), "language": "de-DE",
                "append_to_response": "external_ids,release_dates,videos,keywords,credits",
                "include_video_language": "de,en,null"},
        timeout=30,
    ).json()

    # Both languages: the site has a DE/EN switch. The frontend falls back
    # to whichever exists when one is missing.
    overview_de = (detail.get("overview") or "").strip()
    en = requests.get(f"{API}/movie/{best['id']}",
                      params={"api_key": _key(), "language": "en-US"},
                      timeout=30).json()
    overview_en = (en.get("overview") or "").strip()

    return {
        "tmdb_id": best["id"],
        "imdb_id": detail.get("external_ids", {}).get("imdb_id"),
        # For films with no German release TMDB's "German" title is just the
        # native one, which can be in a script our visitors can't read
        # (बटवारा १९४७). The title the cinema puts on the ticket is better.
        "title_de": _de_title(detail.get("title"), title),
        "title_original": detail.get("original_title") or title,
        "year": int((detail.get("release_date") or "0000")[:4]) or None,
        "release_date": detail.get("release_date") or None,
        "runtime": detail.get("runtime"),
        "poster": IMG + detail["poster_path"] if detail.get("poster_path") else None,
        "genres": [g["name"] for g in detail.get("genres", []) if g.get("name")],
        "age_rating": _fsk(detail),
        "overview_de": overview_de or None,
        "overview_en": overview_en or None,
        "original_language": detail.get("original_language") or None,
        "countries": [c["iso_3166_1"] for c in detail.get("production_countries", [])
                      if c.get("iso_3166_1")][:3],
        "directors": _directors(detail),
        "tags": _tags(detail),
        **dict(zip(("trailer_de", "trailer_en"), _trailers(detail))),
    }


def _directors(detail: dict) -> list[str]:
    crew = (detail.get("credits") or {}).get("crew", [])
    return [p["name"] for p in crew if p.get("job") == "Director" and p.get("name")]


# Topic tags, derived from data TMDB actually has — no guessing about people:
#  - women_directed: TMDB stores a gender field per crew member (1 = female);
#    tagged when at least one credited director is a woman, or the community
#    'woman director' keyword is present. Unknown genders (0) don't count
#    either way, so absence of the tag is not a claim.
#  - queer: matched against TMDB's community-maintained keywords. Keyword
#    coverage is imperfect (smaller films are under-tagged), so this filter
#    surfaces films rather than defines them — the frontend footer says so.
#    Patterns use word boundaries (e.g. 'gay' must be a whole word).
# ("International" and per-language filters are derived in the frontend from
#  original_language, not from keywords.)
TAG_PATTERNS = {
    "queer": re.compile(
        r"lgbt|queer|\bgay\b|lesbian|bisexual|transgender|trans woman|trans man"
        r"|non-binary|genderqueer|drag queen|coming out|same-sex|homosexual",
        re.IGNORECASE),
}


def _tags(detail: dict) -> list[str]:
    tags = []
    keyword_blob = " | ".join(
        k.get("name", "") for k in (detail.get("keywords") or {}).get("keywords", []))

    # two signals: credited director's TMDB gender field, or the community's
    # explicit 'woman director' keyword
    directors = [p for p in (detail.get("credits") or {}).get("crew", [])
                 if p.get("job") == "Director"]
    if any(p.get("gender") == 1 for p in directors) or "woman director" in keyword_blob.lower():
        tags.append("women_directed")

    for tag, pattern in TAG_PATTERNS.items():
        if pattern.search(keyword_blob):
            tags.append(tag)
    return tags


def _trailers(detail: dict) -> tuple[str | None, str | None]:
    """Best YouTube trailer per language: (German, original/English).

    Gives visitors the choice between the dubbed and the original trailer
    when both exist. Prefers proper trailers over teasers, official uploads
    over fan/press ones.
    """
    videos = [v for v in (detail.get("videos") or {}).get("results", [])
              if v.get("site") == "YouTube" and v.get("key")
              and v.get("type") in ("Trailer", "Teaser")]

    def best(candidates):
        if not candidates:
            return None
        b = max(candidates, key=lambda v: (v.get("type") == "Trailer", bool(v.get("official"))))
        return f"https://www.youtube.com/watch?v={b['key']}"

    de = best([v for v in videos if v.get("iso_639_1") == "de"])
    en = best([v for v in videos if v.get("iso_639_1") != "de"])
    return de, en


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
