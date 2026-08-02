"""Classify a showtime as OV, OmU or DE from its labels.

German cinemas mark original-language screenings in the show title or in
flag/attribute fields. Common markers:
  OV / OF / "Originalversion" / "Original Version"  -> original, no subtitles
  OmU / OmdU  -> original with German subtitles
  OmeU        -> original with English subtitles (we count it as OmU-like)
  nothing     -> German dubbed (DE)
"""
import re

OV_PATTERNS = [
    r"\bOV\b",
    # "OF" (Originalfassung) is also the commonest word in English, and a bare
    # \bOF\b matched the word far more often than the marker: measured over all
    # 17 cinemas' feeds on 2026-07-30 it fired 13 times and was the marker
    # *zero* times — "BEST OF CINEMA - Rocky", "Insidious: Out of the Further",
    # and twice on a screening the cinema had itself labelled "D" for German.
    # So only accept it where a marker can actually stand: in brackets, or
    # behind a language abbreviation.
    r"\(\s*OF\s*\)",
    r"\b(?:engl|dt|frz|ital|span|orig)\.?\s*OF\b",
    r"original\s*(version|fassung)",
]
# "subtitled OV" is kinoheld's own flag for an original version *with* subtitles,
# i.e. OmU — so subtitle markers must be checked before the plain OV patterns.
OMU_PATTERNS = [
    r"\bOmU\b", r"\bOmdU\b", r"\bOmeU\b", r"\bOmengU\b",
    r"subtitled", r"mit\s+untertitel", r"with\s+subtitles",
]


def classify(*texts: str) -> str:
    """Return 'OV', 'OmU' or 'DE' given any text fields describing the show."""
    blob = " ".join(t for t in texts if t)
    for pat in OMU_PATTERNS:
        if re.search(pat, blob, re.IGNORECASE):
            return "OmU"
    for pat in OV_PATTERNS:
        if re.search(pat, blob, re.IGNORECASE):
            return "OV"
    return "DE"


def clean_title(title: str) -> str:
    """Strip version markers so TMDB matching works on the bare title.

    Only *known* decorations are removed, never brackets in general: plenty of
    real titles carry them, and a title cut short matches the wrong film, which
    is worse than not matching at all.

    The re-release and anniversary markers are the ones distributors bolt on and
    the cinemas paste straight into their programme —
    'LA HAINE (30TH ANNIVERSARY)(WA:2025)', 'AMORES PERROS (RE 2026)',
    'Der Mondbär (WA:2022)'. TMDB finds nothing for any of them, so the film
    shipped with no poster and no description until a user noticed (2026-08-02).
    The year inside such a marker is deliberately *not* passed on as a year
    hint: 'WA:2025' is when the print was reissued, while the film is from 1995,
    and feeding the wrong vintage to tmdb._pick() empties the result set.
    """
    t = title
    t = re.sub(r"\((OV|OF|OmU|OmdU|OmeU|OmengU)\)", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\b(engl\.?\s*)?(OV|OF|OmU|OmdU|OmeU)\b", "", t)
    t = re.sub(r"\b(3D|IMAX|4DX|Dolby Atmos)\b", "", t, flags=re.IGNORECASE)
    # re-release: (WA:2025) Wiederaufführung, (RE 2026) reissue
    t = re.sub(r"\(\s*(WA|RE)\s*[:.]?\s*(19|20)\d{2}\s*\)", "", t, flags=re.IGNORECASE)
    # anniversary editions, with or without brackets
    t = re.sub(r"\(?\s*\d{1,3}\s*(st|nd|rd|th)\s+anniversary\s*\)?", "", t, flags=re.IGNORECASE)
    # (Extended Version) / (Ext. Version) — the existing rule only caught the
    # dash-separated form, and these arrive in brackets
    t = re.sub(r"\(\s*(ext\.?|extended)\s+version\s*\)", "", t, flags=re.IGNORECASE)
    # a bare year in brackets, e.g. 'Kusama: Infinity (2018)'
    t = re.sub(r"\(\s*(19|20)\d{2}\s*\)", "", t)
    t = re.sub(r"[-–—]\s*(Director'?s Cut|Extended.*)$", "", t, flags=re.IGNORECASE)
    # a bracket left hanging by a truncated feed title
    t = re.sub(r"[(\[]\s*$", "", t)
    return re.sub(r"\s{2,}", " ", t).strip(" -–—:")
