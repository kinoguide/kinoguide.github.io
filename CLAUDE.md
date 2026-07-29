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
  (`kinoheld`, `custom` or `kinopolis`), and notes. Read the `_note` fields.
- `scraper/sources/kinoheld.py` — kinoheld GraphQL client (endpoint
  `next-live.kinoheld.de/graphql`, op `FetchProgramByMovie`). Builds exact
  per-show booking links (`…/vorstellungen?showId=<id>`). `_title_for()` guards
  against kinoheld mis-grouping films under a wrong entry.
- `scraper/sources/kinopolis.py` — Kinopolis showtimes from their own CineOrder
  ticket shop (same one request as the prices, see below). Since 2026-07-25
  this replaces kinoheld for them: kinoheld was missing 10 screenings, almost
  all *newly announced* films already on advance sale, and filed 4 under the
  wrong film — including two it called "Supergirl" at entry, movie and show
  level that were really "Was haben wir gelacht", which no guard could catch.
  The shop also carries OV/OmU per screening in `releaseTypeName` (verified a
  strict superset of the program-page markers) and the film's `productionYear`,
  which settles which film a re-release is. kinoheld stays configured as the
  fallback if the shop call fails.
- `scraper/sources/custom.py` — non-kinoheld / correction scrapers:
  `cineweb()` (Metropolis + Rex am Ring, which read version off their own
  CineWeb sites), `apply_filmpalette_languages()`, and
  `apply_kinopolis_languages()` — the latter now only runs on the kinoheld
  fallback path (Kinopolis OV/OmU comes from the per-showtime `data-version`
  attribute on their program page — NOT the "OV: Moana" caption headings,
  which mislabel).
- `scraper/enrich/` — `tmdb.py` (metadata, both-language overviews, trailers,
  director gender + keyword topic tags, countries), `omdb.py` (IMDb+Metascore,
  7-day cache in `data/ratings_cache.json`), `letterboxd.py` (polite page
  scrape, 7-day cache). A source may pass two optional hints along with each
  show and main.py forwards them:
  - `years` — every year the film could plausibly carry (made in / released
    in; a shelved film like Coyote vs. ACME is 2023 and 2026, a re-release like
    Casablanca 1942 and 1952). `tmdb._pick()` takes the hit matching any of
    them ±1. **Never pass a year to TMDB's own `year` search param** — it
    filters on release date and silently empties the result set.
    When no hit matches, `lookup()` returns None rather than TMDB's first
    guess: a film of the wrong vintage is a different film, and the user's
    rule is that no poster beats someone else's poster.
  - `is_film: False` — a slot with no film behind it, which skips TMDB
    entirely. Kinopolis sets it for the Sneak preview (no productionYear) and
    for live opera/ballet relays (MET live im Kino, Opéra national de Paris,
    Royal Opera House): TMDB only catalogues *recordings*, so the closest it
    can offer is another house's staging of the same work. Cost of that rule:
    the "Geburtstagsgala – 20 Jahre Met live im Kino" loses a match that was
    actually right. Judged worth it — reverse in `_RELAY_RE` if you disagree.
- `scraper/language.py` — OV/OmU/DE classifier from show text/flags.
- `web/src/App.jsx` — the whole React app (single file). `web/src/styles.css` —
  all styling (Art-Deco navy+orange theme). Frontend reads
  `web/public/data/movies.json`. Two structural things live in here:
  - **Routing.** A film is its own page at `?film=<movie.id>` (`FilmPage`), not
    a modal — shareable, and the browser Back button returns to the list at the
    scroll position it was left at. The URL effect *pushes* a history entry when
    `filmId` changes and *replaces* it for filter changes; `fromPop` keeps a
    Back press from re-pushing. Two traps if you touch this: the list's scroll
    position must be captured in `openMovie` (once the shorter film page is
    rendered the browser has already clamped `scrollY`), and
    `history.scrollRestoration` must stay `'manual'` or the browser undoes the
    restore. The film is looked up in the full `data.movies`, so a shared link
    opens even when the recipient's filters would hide it.
  - **Filter organisation** (chosen by the user 2026-07-29): one bar with
    search + Datum + Stadt + Sortierung + a single `⚙ Filter` button with a
    count badge; everything that is switched on also appears as a removable
    chip below the bar; the panel behind the button groups its controls under
    **Schnellfilter · Wann · Wo · Was**. Keep new filters inside that structure
    rather than adding another control to the bar — "all jumbled up" was the
    complaint that prompted it.
- `web/src/prices.js` — the price model: a hand-curated price table per cinema
  (day tiers, family ticket, surcharges, offers; each entry carries a `checked`
  date the UI shows) **plus** the calculator that prefers the cinema's own
  per-screening prices from `data/prices.json` and only falls back to the table.
  Only **Kinopolis Bad Godesberg** so far; adding a cinema = one more entry keyed
  by its exact name in `movies.json`. See "Prices" below.
- `scraper/sources/kinopolis_prices.py` — one daily call to Kinopolis' ticket
  shop for the exact price of every screening → `data/prices.json`.

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

## Design (settled 2026-07-29)

The frontend is an **Art-Deco "Lichtspielhaus"** look: soft midnight-navy
background + warm burnt-orange/gold accents, marquee light-strip under the
header, uppercase logo, single dark theme (`color-scheme: dark`).

**The styling question is closed.** Asked whether to push the Deco further,
keep it, or strip it back, the user answered "it is okay as it is" — the
"maxed Art-Deco" mockup (sunburst, period display font, corner brackets) is not
wanted. Their complaint was never the palette but the *controls* being crowded,
which the filter-bar rework above addresses. Don't reopen the theme unprompted;
for any aesthetic choice, show options first (they asked to "gather ideas and
present first").

## Performance notes

The page ships ~250 films and ~1 550 screenings in one 710 KB JSON, so the
frontend is deliberately built to keep that cheap:

- `index.html` starts `fetch('data/movies.json')` into `window.__movies` before
  the JS bundle loads; `App` adopts that promise instead of fetching again.
- `.card` uses `content-visibility: auto` + `contain-intrinsic-size` — the
  browser skips layout/paint for off-screen cards. Measured on the full grid: a
  relayout costs **7 ms instead of 93 ms**. If you change the card's height,
  update `contain-intrinsic-size` too or the scrollbar drifts.
- `Card` is `memo`-ised, the filter chain is a single pass, the search box feeds
  the filter through `useDeferredValue`, and the favourites list only re-filters
  when the Favoriten filter is actually on (`favKey`).
- `data/prices.json` is still lazy-loaded on first use of a price panel.

## Prices (family price finder, added 2026-07-25)

A 💶 chip in the toolbar and a "💶 ab X €" button on each cinema row in the
film popup open a price panel: the visitor sets how many adults / kids under 12
/ students are coming (kept in localStorage), and gets every screening we know
prices for, **cheapest total first**, with the per-ticket breakdown and a
booking link. The Kinopolis **Family Ticket** (before 18:00 the whole family
pays the child price) is applied automatically, so the panel shows a family
directly how much an afternoon show saves over the evening.

Prices come from the cinema itself where we have them (see below); the rules
baked into `prices.js` are the fallback: four day tiers (Mo–Do / Fr and the working day
before a holiday / Sa / So+Feiertage, with NRW holidays listed), Matinee,
Happy Hour, Late Night, child + reduced fares, the Family-Ticket rule (FSK ≤ 12
only) and an optional 3D surcharge. With kids in the party, films above FSK 12
are left out. Every panel shows the full price table, surcharges, the combi /
Ferienkino / Kindergeburtstag / KidsClub offers and links to the cinema's own
price page; rows with exact prices also show what a kids' menu adds per ticket.

### The printed price list is only a floor

Kinopolis adds a **per-film surcharge of 0 … 2,50 €** ("filmbezogener Zuschlag"
on their price page) that nothing we scrape can predict. Measured 2026-07-25 on
directly comparable screenings (Mo–Thu 12–18h, plain 2D, child ticket, list
price 7,49 €): Toy Story 5 / Conni / Miss Moxy **7,49**, Vaiana / Minions
**7,99**, Mandalorian & Grogu **8,99**, Die Odyssee **9,49**. There is **no**
online booking fee — films without a surcharge cost the list price in the shop
too. (An earlier version of this file blamed a 0,50 € Vorverkaufsgebühr; that
was wrong, Minions simply carries a 0,50 € film surcharge.)

So the surcharge has to come from the cinema, and it does:

### data/prices.json — exact prices per screening

`scraper/sources/kinopolis.py` calls their webshop once per run — the request
lives there because the *showtimes* come out of the same payload, and
`kinopolis_prices.py` reads the prices from the cached response:

    GET iframe.ts.kinopolis.de/api/films?locale=de&include.pricecategories=true
    Header: CENTER-OID: <cineorder_center_oid from cinemas.json>

One request, ~300 KB gzipped, returns the whole program with **every price
category of every screening** — surcharge, format (3D / D-BOX / Atmos), event
pricing ("Normal Oper" 20–36 €, KINOFEST 5 €, Late Night, Best of Cinema) and
the real combi-menu prices all included. The header is the entire auth: without
`CENTER-OID` every `/api/…` call answers 401; with it, no session or token is
needed. Their robots.txt allows generic agents (`use=reference`) and blocks
AI-training crawlers, which we aren't.

Output is `data/prices.json` → `{cinemas: {<name>: {shows: {<showId>: {adult,
child, reduced, family?, menu_*, format?}}}}}`. `data/prices.json` is committed
with the daily data; the workflow copies it to `web/public/data/prices.json`,
which is gitignored like the movies copy. The join key is the
performance id in the booking URL (`…/vorstellung/<id>`) — now that the
showtimes come from the same payload, **all** Kinopolis showtimes match and the
panel shows no estimates for them (it was 99% via kinoheld). The frontend lazy-loads the file when the price panel opens,
uses exact figures where they exist, and falls back to the curated table with an
"≈ geschätzt" marker otherwise. `family` is only present on screenings where the
cinema actually grants the Familienpreis, so that rule needs no guessing.

It's an internal API and may change without notice: `collect()` swallows its own
errors, main.py keeps the last good file, and the frontend degrades to the table.

When touching the curated table: re-read the cinema's price page, keep the column
spans straight (their table is colspan-based — e.g. the child price still holds
on Fridays while adult evening prices already jump), and bump `checked`.

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
