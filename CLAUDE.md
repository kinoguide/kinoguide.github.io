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
- **21 cinemas** across Köln & Bonn, ~280 films/day. Everything below is DONE:
  scraper, all cinema sources, enrichment, daily automation, and a polished
  frontend (search, filters, favorites, schedule view, i18n DE/EN, calendar
  export, shareable filter URLs). See [[cinema-coverage]] for how each cinema
  is sourced.

## Architecture / key files

- `scraper/main.py` — orchestrator: scrape every cinema (isolated failures) →
  enrich → write `data/movies.json` (+ a top-level `cinemas` map). Also applies
  per-cinema language corrections (Filmpalette, Kinopolis).
- `scraper/cinemas.json` — the 21 cinemas: kinoheld IDs, `website`, `price_page`,
  `source` (`kinoheld`, `custom` or `kinopolis`), the CineOrder shop coordinates
  where there is one (`cineorder_api`, `cineorder_center_oid`,
  `family_max_adults`), and notes. Read the `_note` fields.
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
- `scraper/language.py` — OV/OmU/DE classifier from show text/flags. **Careful
  with the OV markers: they are short and they collide with ordinary words.** A
  bare `\bOF\b` (Originalfassung) matched the English "of" in every single case
  it fired across all feeds — "BEST OF CINEMA - Rocky", "Insidious: Out of
  the Further", and twice on a screening the cinema had itself labelled "D".
  It now only counts in brackets or behind a language abbreviation. Measure any
  new marker against the real feeds before adding it; a false OV is exactly the
  mislabel the conventions below tell you to avoid.
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
    opens even when the recipient's filters would hide it. Static sub-pages ride
    the same machinery under `?seite=<name>` — currently only `?seite=kontakt`
    (`ContactPage`: feedback + Impressum, reached by the ✉ button in the header
    and a footer link). Both are folded into one `route` string, and that is what
    the push/replace and scroll-restore logic keys on; add a page by extending
    `page`, not by inventing a second mechanism.
  - **The feedback form** (`FeedbackForm`, added 2026-08-01). Posts to
    **FormSubmit** (`https://formsubmit.co/ajax/<CONTACT_MAIL>`), which forwards
    the message to kinokoelnbonn@gmail.com: a static site has no back end of its
    own, and the user picked FormSubmit over Web3Forms/Formspree because it needs
    no account and the address is public in the Impressum anyway. Message first,
    **then** the question "möchtest du eine Antwort?" — an empty mail field sends
    anonymously, and that is the default, not an opt-out. Gotcha: FormSubmit
    ignores a form until it is activated once by clicking the link in the mail
    that its first submission triggers (sent 2026-08-01); before that it answers
    `success:false` and the visitor gets the fail screen, which offers the plain
    mailto as a fallback. The DE/EN switch is the first element of the topbar —
    on phones the logo takes the whole line, so a ≤640px `order` rule puts the
    switch hard left on the second row with the date + ✉ opposite it. Since
    2026-08-01 it shows flags instead of the letters, and they are **drawn SVG**:
    Windows ships no flag glyphs, so 🇩🇪/🇬🇧 degrade to a box reading "DE"/"GB"
    in every browser on the user's own OS. Both sit in the same 3:2 box (the
    Union Jack is built in a 60×40 viewBox for it); the inactive one is greyed
    so the orange pill alone carries the state.
  - **Filter organisation** (chosen by the user 2026-07-29): one bar with
    search + Datum + Stadt + Sortierung + a single `⚙ Filter` button with a
    count badge + the `💶 Preise` button (moved up out of the results row on
    2026-07-30 at the user's request — it is a destination, not a filter);
    everything that is switched on also appears as a removable
    chip below the bar; the panel behind the button groups its controls under
    **Schnellfilter · Wann · Wo · Was**. Keep new filters inside that structure
    rather than adding another control to the bar — "all jumbled up" was the
    complaint that prompted it. The bar's three menus (`Menu`) render their
    popover `position: fixed` from the button's rect on purpose: the button row
    scrolls sideways, and a scroll container clips an absolutely positioned
    menu right out of existence on narrow screens.
  - **The screening box** (`.showbox`, film page, reworked 2026-07-31). One box
    per screening: time + OV/OmU tag on top, `🎟️ Tickets` + 📅 underneath. The
    booking link cannot wrap the whole box — the calendar download is a link too
    and links don't nest — so the box is a plain `div` with two links inside.
    Desktop lays ~4 boxes per row; **below 640px it turns into a full-width
    horizontal strip** with the day label stacked above, because a column of
    boxes beside a 74px day label left half the width empty. Watch the width:
    at 320px the strip is within a few px of its box, so `.showbox` carries
    `flex-flow: row wrap` as a safety net and a ≤370px rule trims the paddings.
    Content spilling over the border is the bug this replaced.
  - **Original-language filter.** Every language in the day's program gets a
    pill (no minimum film count), names come from `LANGUAGES` and fall back to
    `Intl.DisplayNames` so an unmapped code never shows raw. `PINNED_LANGS`
    (currently `ko`) stays on offer even with nothing playing, marked with a
    dashed border and a `0` — the user asked for a permanent Korean button.
- `web/src/prices.js` — the price model: a hand-curated price table for **18 of
  the 21 cinemas** (each with its own day tiers, tickets, family rule, surcharges,
  offers and a `checked` date the UI shows) **plus** the calculator that prefers
  the cinema's own per-screening prices from `data/prices.json` and falls back to
  the table. Adding a cinema = one more entry keyed by its exact name in
  `movies.json`. See "Prices" below.
- `scraper/sources/cineorder.py` — the CineOrder ticket-shop client: one daily
  call per cinema that yields the program, the exact price of every screening
  (→ `data/prices.json`) and its OV/OmU version. Kinopolis takes all three from
  it; Cinedom keeps kinoheld's showtimes (kinoheld has *more* of them — it still
  lists today's after the shop drops them from sale) but takes prices and
  languages from the shop via `apply_languages()`, joined on the performance id
  in the booking link.

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

The page ships ~280 films and ~1 500 screenings in one 710 KB JSON, so the
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

## Prices (family price finder — 18 of the 21 cinemas)

A 💶 chip in the toolbar and a "💶 ab X €" button on each cinema row in the
film page open a price panel: the visitor sets how many adults / kids under 12
/ students are coming (kept in localStorage), and gets every screening we know
prices for, **cheapest total first**, with the per-ticket breakdown and a
booking link. Family fares are applied automatically, so the panel shows a
family directly how much an afternoon show saves over the evening.

Two sources feed it, and they are not equal:

| | cinemas | what it is |
|---|---|---|
| exact | Kinopolis Bad Godesberg, Cinedom | the cinema's own till, per screening (`data/prices.json`) |
| table | 16 more | the printed price list, typed by hand into `web/src/prices.js` |
| none | Residenz Astor Film Lounge, Filmforum NRW, SION Sommerkino | they publish no price list at all — see the Woki rule below |

Coverage on 2026-08-01: every cinema with a table prices 100 % of its screenings,
except the Woki (18 %, on purpose — see below); the three houses above price none
because they publish nothing. Of Cinedom's 251 screenings 209 are exact,
Kinopolis 228 of 228; the rest fall back to the table with an "≈ geschätzt" mark.
`npm run check:coverage` in `web/` prints that table from the live data, and
`npm run check:prices` asserts the model against the figures on the price pages
— run both after touching prices.

### The printed price list is only a floor

Kinopolis adds a **per-film surcharge of 0 … 2,50 €** ("filmbezogener Zuschlag"),
Cinedom a "Blockbusterzuschlag" of 1,50–2,00 €, and almost every house an
overlength surcharge. Measured at Kinopolis 2026-07-25 on directly comparable
screenings (Mo–Thu 12–18h, plain 2D, child ticket, list price 7,49 €): Toy Story
5 / Conni / Miss Moxy **7,49**, Vaiana / Minions **7,99**, Mandalorian & Grogu
**8,99**, Die Odyssee **9,49**. There is **no** online booking fee at either
house — films without a surcharge cost the list price in the shop too. (Cinenova
is the exception among the table cinemas: they add 10 % VVK online, which
`onlineFeePct` includes.)

So the surcharge has to come from the cinema, and for two of them it does:

### data/prices.json — exact prices per screening (CineOrder)

`scraper/sources/cineorder.py` calls each shop once per run. Kinopolis' *showtimes*
come out of the same payload, so the two cost one request between them:

    GET <cineorder_api>?locale=de&include.pricecategories=true
    Header: CENTER-OID: <cineorder_center_oid from cinemas.json>

    Kinopolis Bad Godesberg   iframe.ts.kinopolis.de   20000000014VEGOZTB
    Cinedom                   shop.cinedom.de          9DD10000014AKQLNRG

One request each, a few hundred KB gzipped, returns the whole program with
**every price category of every screening** — surcharge, format (3D / D-BOX /
Atmos), event pricing ("Normal Oper" 20–36 €, KINOFEST 5 €, Late Night, Best of
Cinema) and the real combi-menu prices all included. The header is the entire
auth: without `CENTER-OID` every `/api/…` call answers 401; with it, no session
or token is needed. Their robots.txt allows generic agents (`use=reference`) and
blocks AI-training crawlers, which we aren't.

Output is `data/prices.json` → `{cinemas: {<name>: {shows: {<showId>: {adult,
child, reduced, family?, menu_*, format?}}, family_max_adults?}}}`. It is
committed with the daily data; the workflow copies it to
`web/public/data/prices.json`, which is gitignored like the movies copy.

The join key is the performance id the booking URL already carries — Kinopolis
puts it in the path (`…/vorstellung/<id>`), Cinedom in a query parameter
(`…?performance=<id>`, which arrives via kinoheld's deeplink). `showId()` in
prices.js matches both. Verified against the real Cinedom shop on 2026-07-30:
Toy Story 5 (Atmos) Fr 31.07. 13:40 rang up Erwachsener 10,00 € / Kind & Fam
8,00 €, Die Odyssee Fr 31.07. 20:15 Erwachsener 13,50 € / Kind 10,50 € — exactly
what the collector derives, with no fee added.

Seating area 1 is the standard seat at both shops (Kinopolis Komfort, Cinedom
Parkett; 2 = Loge, 3 = VIP), confirmed against the rendered seat plan.

It's an internal API and may change without notice: `collect()` swallows its own
errors, main.py keeps the last good file, and the frontend degrades to the table.

### The curated tables (web/src/prices.js)

Each cinema declares **its own day tiers** — there is no shared set, because
Thursday is the cheap day at Odeon / OFF Broadway / Weisshaus / Kalk / Rex am
Ring / Metropolis, Tuesday at the Woki, and Kinopolis splits Mo–Do / Fr / Sa /
So. A tier matches on weekday, whether the date is a public holiday, and whether
it is the day *before* one; first match wins, last entry is the catch-all. The
file's header comment documents the full entry shape.

Two things are computed rather than listed where the cinema publishes exact
steps: `lengthSurcharge` (from `movie.runtime`) and `onlineFeePct`.

Three traps that produced wrong prices during the build, all now guarded by
`check_prices.mjs`:

- **A missing rating is not a qualifying rating.** `familyApplies` used to treat
  an unknown FSK as eligible, which quoted a family the child price for
  *Vaterland* and a horror sequel. It now requires a known FSK within range.
- **A low rating is not a children's film.** Where the cinema's own wording asks
  for one ("Kinder- und Familienfilme", "Filme mit Kennzeichnung KiFi"), the
  entry sets `familyTicket.familyFilmOnly` and we also require an
  Animation/Familie genre — *Liebe braucht keine Ferien* is FSK 0 and still not a
  kids film. Cinedom and Cineplex word their offers purely by rating, so the flag
  stays off there.
- **A ticket row that nobody may buy makes the whole screening disappear.** If no
  row fits a visitor, `showPrice` returns null and the panel silently drops the
  screening. The check brute-forces every cinema × day × hour × visitor.

Programme strands we cannot identify from our data (Kinemathek Kids-Veranstaltungen,
Weisshaus KidsKino, Kalk's Kinder- & Jugendprogramm, Cinenova Kinderfilme) are
listed under `displayOnly` and never auto-picked — showing the regular price is
only ever too high, which the "≈ geschätzt" mark already covers.

**Coverage audit 2026-08-01.** kinoheld's own directory was swept by GPS radius
around both cities (`cinemas(proximity:{location,distance})`, 15 km) and checked
against kino.de's city lists; every venue we did not have was probed for a live
programme. That added four: Residenz Astor Film Lounge (id 1085 — the real gap,
76 screenings, a 3-hall first-run house), Filmforum NRW (507), Arthaus-Kino im
LandesMuseum (1461, the Kinemathek's second screen) and SION Sommerkino (2196,
seasonal open air). Everything else in both cities is either covered or carries
no bookable programme at all (Filmclub Akasava, Passage Kino, Institut Français,
Japanisches Kulturinstitut, Alte Feuerwache, Turistarama, both drive-ins, Kino im
Kunstmuseum Bonn, and the open-airs MAKK / Olympia / Fort X / Gebäude 9 /
Bonner Sommerkino / Bundeskunsthalle / Friesi / Arkadenhof). **Filmclub 813**
(Hahnenstr. 6, ~19 screenings a month on 35mm) is a real cinema with no feed —
own site only, box-office tickets, summer break until 2026-10-02 — so it needs a
custom scraper like Metropolis, deferred by the user to October.

**The Woki publishes no standard price at all** ("Klicke auf die Vorstellungszeit
und suche Dir einen Sitzplatz aus. So kannst Du sehen, was Deine Karte kostet.").
Only their Kino-Dienstag (2D 6,99 € / 3D 9,99 €) is stated unambiguously, so that
is the only thing we calculate; the rest of their week deliberately shows no
price rather than a guess.

**Cineplex Köln blocks scripted access** — cineplex.de answers 403 to every
non-browser agent, so their table was read by hand in a browser and can only be
refreshed that way.

When touching a curated table: re-read the cinema's price page, keep the column
spans straight (several are colspan-based — e.g. Kinopolis' child price still
holds on Fridays while adult evening prices already jump), take the LOWER end of
any printed range (the UI says "ab X €"), bump `checked`, and run both checks.

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
