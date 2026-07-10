# Kinoguide Köln/Bonn — project briefing

The user is **not a coder** — explain things simply, run terminal commands for
them, and confirm before destructive actions. They are on **Windows**; a Bash
tool is available (Git Bash) and is used for most commands here, but PowerShell
works too. Node lives at `C:\Program Files\nodejs` and `gh` at
`C:\Program Files\GitHub CLI` — add to PATH in Bash when needed.

## What this project is

A kinoguide.fyi-style guide for **Köln & Bonn**: a daily Python scraper collects
all cinema showtimes with language version (OV / OmU / DE), enriches them with
IMDb + Metascore + Letterboxd ratings and TMDB metadata (poster, genres, FSK,
country, director, trailers, topic tags), writes `data/movies.json`; a
Vite/React frontend in `web/` displays it with rich filters. GitHub Actions
(`.github/workflows/scrape.yml`) runs the scrape + deploy daily.

## Status — LIVE and fully working

- **Live site:** https://kinoguide.github.io/ (clean root URL).
- **Repo:** https://github.com/kinoguide/kinoguide.github.io — owned by the
  **kinoguide** org (GitHub account `chris-geller` is org admin). Local `origin`
  points here. See the [[deployment]] memory for the org-permissions gotcha.
- **17 cinemas** across Köln & Bonn, ~250 films/day. Everything below is DONE:
  scraper, all cinema sources, enrichment, daily automation, and a polished
  frontend (search, filters, favorites, schedule view, i18n DE/EN, calendar
  export, shareable filter URLs). See [[cinema-coverage]] for how each cinema
  is sourced.

## Architecture / key files

- `scraper/main.py` — orchestrator: scrape every cinema (isolated failures) →
  enrich → write `data/movies.json` (+ a top-level `cinemas` map). Also applies
  per-cinema language corrections (Filmpalette, Kinopolis).
- `scraper/cinemas.json` — the 17 cinemas: kinoheld IDs, `website`, `source`
  (`kinoheld` or `custom`), and notes. Read the `_note` fields.
- `scraper/sources/kinoheld.py` — kinoheld GraphQL client (endpoint
  `next-live.kinoheld.de/graphql`, op `FetchProgramByMovie`). Builds exact
  per-show booking links (`…/vorstellungen?showId=<id>`). `_title_for()` guards
  against kinoheld mis-grouping films under a wrong entry.
- `scraper/sources/custom.py` — non-kinoheld / correction scrapers:
  `cineweb()` (Metropolis + Rex am Ring, which read version off their own
  CineWeb sites), `apply_filmpalette_languages()`, and
  `apply_kinopolis_languages()` (Kinopolis OV/OmU comes from the per-showtime
  `data-version` attribute on their program page — NOT the "OV: Moana" caption
  headings, which mislabel).
- `scraper/enrich/` — `tmdb.py` (metadata, both-language overviews, trailers,
  director gender + keyword topic tags, countries), `omdb.py` (IMDb+Metascore,
  7-day cache in `data/ratings_cache.json`), `letterboxd.py` (polite page
  scrape, 7-day cache).
- `scraper/language.py` — OV/OmU/DE classifier from show text/flags.
- `web/src/App.jsx` — the whole React app (single file). `web/src/styles.css` —
  all styling (Art-Deco navy+orange theme). Frontend reads
  `web/public/data/movies.json`.

## Run / deploy

- Scrape locally: `cd scraper && python main.py` (reads keys from repo-root
  `.env`, gitignored — NEVER commit it). Then
  `cp data/movies.json web/public/data/movies.json`.
- Frontend dev: preview via the Browser-pane tools (launch config `web`), or
  `cd web && npm run dev`. Build: `npm run build`.
- Deploy = just `git push` to `origin main` (or the daily cron). The workflow
  scrapes, commits data, builds, and deploys to Pages. Secrets `TMDB_API_KEY` /
  `OMDB_API_KEY` are set on the repo. Watch a run:
  `gh run watch <id> --repo kinoguide/kinoguide.github.io`.
- In **Git Bash**, `gh api` paths must OMIT the leading slash (bash rewrites
  `/orgs/...` into a filesystem path).

## Design work in progress (as of 2026-07-08)

The frontend was restyled to an **Art-Deco "Lichtspielhaus"** look: soft
midnight-navy background + warm burnt-orange/gold accents, marquee light-strip
under the header, uppercase logo. Controls use progressive disclosure: one
**Quick-filters** dropdown (Last Minute, Kinderfilme, Regie: Frauen,
International, Queer + "Mehr Filter"), plus **city / date / sort** dropdowns.
Committed to a single dark theme (`color-scheme: dark`).

OPEN DECISION: the user is deciding whether to push the Deco styling further.
A "maxed Art-Deco" mockup was shown (marquee frame + sunburst, embedded period
font, gold hairline/chevron dividers, corner-bracket cards, double gold frame).
If they say yes, apply those to `web/src/styles.css` (and embed a real
Futura/Broadway-style display face as a @font-face data URI — CDN fonts are not
used). If "subtler", dial specific elements back.

## Conventions

- One scraper module per source in `scraper/sources/`; a failing cinema must
  never abort the whole run (main.py isolates errors per cinema).
- Scrape politely: identifying User-Agent, once daily, caches to keep OMDb/
  Letterboxd usage low.
- Keep the `movies.json` schema stable, or update `web/src/App.jsx` with it.
- Verify data changes against reality before shipping — kinoheld and cinema
  sites have quirks (mis-grouped films, missing language flags, caption
  headings that lie). When a fix could mislabel (e.g. calling a German show OV),
  prefer under-labeling over shipping wrong data, and say so.
- All UI strings are in the `T` i18n object (de + en) in App.jsx.
