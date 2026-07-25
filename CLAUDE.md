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
- `web/src/prices.js` — **hand-curated** ticket prices + the price calculator
  (day tiers, family ticket, surcharges, offers). No ticket back-end exposes
  prices, so these are typed off the cinema's own price page; each entry carries
  a `checked` date that the UI shows. Only **Kinopolis Bad Godesberg** so far
  (checked 2026-07-25); adding a cinema = one more entry keyed by its exact
  name in `movies.json`. See "Prices" below.

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

## Prices (family price finder, added 2026-07-25)

A 💶 chip in the toolbar and a "💶 ab X €" button on each cinema row in the
film popup open a price panel: the visitor sets how many adults / kids under 12
/ students are coming (kept in localStorage), and gets every screening we know
prices for, **cheapest total first**, with the per-ticket breakdown and a
booking link. The Kinopolis **Family Ticket** (before 18:00 the whole family
pays the child price) is applied automatically, so the panel shows a family
directly how much an afternoon show saves over the evening.

Rules baked into `prices.js`: four day tiers (Mo–Do / Fr and the working day
before a holiday / Sa / So+Feiertage, with NRW holidays listed), Matinee,
Happy Hour, Late Night, child + reduced fares, the Family-Ticket rule (FSK ≤ 12
only) and an optional 3D surcharge. With kids in the party, films above FSK 12
are left out. Every panel shows the full price table, surcharges, the combi /
Ferienkino / Kindergeburtstag / KidsClub offers and links to the cinema's own
price page — combi-ticket prices are only revealed in Kinopolis' booking flow,
so we describe what's in them instead of quoting a price.

**Online prices are not the printed prices.** Kinopolis' shop (CineOrder,
`iframe.ts.kinopolis.de/api/performances/<showId>?include.pricecategories=true`
— session-bound, 401 without the webshop's token, so we can't poll it) prices
every ticket as
`list price + film-related surcharge + seat surcharge + 0,50 € Vorverkaufsgebühr`.
Verified 2026-07-25: Vaiana Mo 14:30 child 7,49 → **7,99** online; Die Odyssee
(3h20, so +1,50 overlength) Mo 19:45 child 8,49 → **10,49**. Hence
`advanceSaleFee: 0.5` and the "Online kaufen" checkbox (on by default, because
our ticket links go to that shop). The per-film surcharge isn't in our data —
the panel warns about it instead of guessing. If a total ever disagrees with the
shop, check that surcharge first: the shop API's `priceCategories` is the
ground truth, and the same call also reveals real combi-menu prices
(Kinder-/Familien-Menü = +5,00 € on the ticket).

When touching prices: re-read the cinema's price page, keep the column spans
straight (their table is colspan-based — e.g. the child price still holds on
Fridays while adult evening prices already jump), and bump `checked`.

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
