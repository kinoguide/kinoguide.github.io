// --- ticket prices ---------------------------------------------------------
// Hand-curated per cinema. None of the ticket back-ends we scrape (kinoheld,
// CineWeb, kinotickets.express) exposes prices, so these are typed off the
// cinemas' own price pages and re-checked by hand — hence the `checked` date,
// which the UI always shows next to a link to the source page.
//
// Kinopolis Bad Godesberg is the try-out. To cover a second cinema, add
// another entry keyed by the exact cinema name used in movies.json.
//
// Every `price` array is indexed by DAY TIER:
//   0 = Mo–Do    1 = Fr (and Mo–Do before a holiday)    2 = Sa    3 = So + Feiertage
// Those are the four columns of the Kinopolis table, and the arrays follow its
// column spans exactly — e.g. the child/family price still holds on Fridays,
// while adult evening prices already jump on Friday. `null` = not sold that day.
//
// Times are minutes after midnight, `to` exclusive (1080 = 18:00, 1290 = 21:30).
//
// These are the printed list prices and they are only the FLOOR of what a
// screening costs: on top comes a film-related surcharge of 0 … 2,50 € that
// Kinopolis sets per film. Measured 2026-07-25 on directly comparable
// screenings (Mo–Thu 12–18h, plain 2D, child ticket, list price 7,49 €):
//   Toy Story 5 / Conni / Miss Moxy 7,49 · Vaiana / Minions 7,99
//   Mandalorian & Grogu 8,99 · Die Odyssee 9,49
// There is no separate online booking fee — a film with no surcharge costs the
// list price in the shop too. The surcharge isn't derivable from anything we
// scrape, so `data/prices.json` (see scraper/sources/kinopolis_prices.py) carries
// the cinema's own per-screening prices and this table is the fallback for
// screenings that file doesn't cover — flagged as an estimate in the UI.

// NRW public holidays — they carry Sunday prices, and the working day before
// one carries Friday prices. Only the years the program can reach.
const HOLIDAYS_NRW = new Set([
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-14',
  '2026-05-25', '2026-06-04', '2026-10-03', '2026-11-01', '2026-12-25', '2026-12-26',
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-01', '2027-05-06',
  '2027-05-17', '2027-05-27', '2027-10-03', '2027-11-01', '2027-12-25', '2027-12-26',
])

const localDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function dayTier(d) {
  if (HOLIDAYS_NRW.has(localDay(d))) return 3
  const wd = d.getDay() // 0 = Sunday
  if (wd === 0) return 3
  if (wd === 6) return 2
  if (wd === 5) return 1
  const next = new Date(d.getTime() + 86400000)
  return HOLIDAYS_NRW.has(localDay(next)) ? 1 : 0 // Mo–Do before a holiday
}

export const TIER_LABELS = {
  de: ['Mo–Do', 'Fr / vor Feiertagen', 'Sa', 'So & Feiertage'],
  en: ['Mon–Thu', 'Fri / day before holiday', 'Sat', 'Sun & holidays'],
}

export const CINEMA_PRICES = {
  'Kinopolis Bad Godesberg': {
    checked: '2026-07-25',
    source: 'https://www.kinopolis.de/bn/preise',
    offersUrl: 'https://www.kinopolis.de/bn/angebote',
    // who: 'any' = price of the screening (anyone can buy it),
    // 'adult' / 'child' / 'reduced' = tied to the visitor
    tickets: [
      { id: 'matinee', who: 'any', from: 0, to: 720, price: [7.49, 7.49, 7.49, 9.49],
        de: 'Matinee (vor 12 Uhr)', en: 'Matinee (before 12:00)' },
      { id: 'happy', who: 'adult', from: 0, to: 1080, price: [9.49, 9.49, 12.49, 12.49],
        de: 'Happy Hour (vor 18 Uhr)', en: 'Happy hour (before 18:00)' },
      { id: 'adult', who: 'adult', from: 1080, to: 1440, price: [10.99, 13.49, 13.49, 13.49],
        de: 'Erwachsene (ab 18 Uhr)', en: 'Adults (from 18:00)' },
      { id: 'child', who: 'child', from: 0, to: 1080, price: [7.49, 7.49, 8.49, 8.49],
        de: 'Kinder unter 12 & Family Ticket (vor 18 Uhr)', en: 'Under 12 & family ticket (before 18:00)' },
      { id: 'child_evening', who: 'child', from: 1080, to: 1440, price: [8.49, 9.99, 9.99, 9.99],
        de: 'Kinder unter 12 (ab 18 Uhr, kein Family Ticket)', en: 'Under 12 (from 18:00, no family ticket)' },
      { id: 'reduced', who: 'reduced', from: 0, to: 1080, price: [7.49, 7.49, 10.49, 10.49],
        de: 'Ermäßigt (vor 18 Uhr)', en: 'Reduced (before 18:00)' },
      { id: 'reduced_evening', who: 'reduced', from: 1080, to: 1440, price: [8.99, 11.49, 11.49, 11.49],
        de: 'Ermäßigt (ab 18 Uhr)', en: 'Reduced (from 18:00)' },
      { id: 'late', who: 'any', from: 1290, to: 1440, price: [6.99, null, null, 6.99],
        de: 'Late Night (ab 21:30 Uhr)', en: 'Late night (from 21:30)' },
    ],
    // shown in the price list, but never auto-picked: they need a specific
    // screening (Sneak) or a pass bought up front (Superticket)
    displayOnly: [
      { de: 'Sneak Preview Night (Di, Überraschungsfilm)', en: 'Sneak preview night (Tue, surprise film)', flat: 5.99 },
      { de: 'Superticket: 5× Kino in 2D (personengebunden)', en: 'Superticket: 5 × 2D cinema (name-bound)', flat: 35.0 },
    ],
    surcharges: [
      { de: '3D (inkl. Brille)', en: '3D (incl. glasses)', amount: 3.0 },
      { de: 'Premium-Sessel inkl. Fußhocker', en: 'Premium seat incl. footstool', amount: 4.5 },
      { de: 'D-BOX Motion Seat', en: 'D-BOX motion seat', amount: 6.0 },
      { de: 'Filmbezogener Zuschlag (z. B. Überlänge)', en: 'Film-related surcharge (e.g. long films)', amount: 2.5, upTo: true },
    ],
    threeD: 3.0,
    // the money-saver: before 18:00 the whole family pays the child price
    familyTicket: {
      before: 1080, childUnder: 12, maxFsk: 12,
      de: 'In Begleitung eines Kindes unter 12 zahlen alle Familienangehörigen in Vorstellungen vor 18 Uhr den Kinderpreis (Kinder- und Familienfilme mit FSK 0, 6 oder 12; Sonderveranstaltungen ausgenommen, ggf. zzgl. Zuschläge).',
      en: 'Accompanying a child under 12, every family member pays the child price for screenings before 18:00 (kids/family films rated FSK 0, 6 or 12; special events excluded, surcharges may apply).',
    },
    // family-relevant offers; Kinopolis only reveals combi prices in the
    // booking flow, so we describe what's in them and link out
    offers: [
      { de: 'Super Deal Familien Menü — + 5,00 € aufs Ticket: 0,5 l Softdrink + mittleres Popcorn (im Rahmen des Familienpreises)',
        en: 'Super Deal family menu — + €5.00 on top of the ticket: 0.5 l soft drink + medium popcorn (within the family price)',
        url: 'https://www.kinopolis.de/bn/spezial/kombiangebote' },
      { de: 'Super Deal Kinder Menü — + 5,00 € aufs Ticket (statt 7,49 €): 0,3 l Softdrink + Kinder-Popcorn + Überraschungstüte',
        en: 'Super Deal kids menu — + €5.00 on top of the ticket (instead of €7.49): 0.3 l soft drink + kids popcorn + surprise bag',
        url: 'https://www.kinopolis.de/bn/spezial/kombiangebote' },
      { de: 'Ferienkino — Ticket + 0,75 l Softdrink + mittleres Popcorn, ab 13,49 €. In den Ferien Mo–Fr vor 18 Uhr, nur für Schüler:innen/Studierende/Azubis mit Ausweis, nicht an Feiertagen.',
        en: 'Ferienkino — ticket + 0.75 l soft drink + medium popcorn, from €13.49. During school holidays Mon–Fri before 18:00, students/apprentices with ID only, not on public holidays.',
        url: 'https://www.kinopolis.de/bn/angebote/ferienkino/303' },
      { de: 'Kindergeburtstag — Ticket (vor 18 Uhr, FSK 0/6/12) + Kinder-Popcorn + 0,3 l Softdrink + Überraschung: Mo–Fr ab 9,99 €, Wochenende/Feiertage ab 11,99 € pro Kind. Geburtstagskind frei, ab 6 Kindern + 1 Erwachsener, Anmeldung 5 Tage vorher.',
        en: 'Kids birthday — ticket (before 18:00, FSK 0/6/12) + kids popcorn + 0.3 l soft drink + surprise: Mon–Fri from €9.99, weekends/holidays from €11.99 per child. Birthday child free, min. 6 children + 1 adult, book 5 days ahead.',
        url: 'https://www.kinopolis.de/bn/angebote/kindergeburtstag-im-kino' },
      { de: 'KidsClub (6–11 Jahre) — kostenlose Mitgliedschaft, Clubkarte, Newsletter, Geburtstagsüberraschung',
        en: 'KidsClub (ages 6–11) — free membership, club card, newsletter, birthday surprise',
        url: 'https://www.kino-kidsclub.de/bn' },
    ],
  },
}

export const hasPrices = (cinema) => !!CINEMA_PRICES[cinema]

export const PARTY_CATS = ['adult', 'child', 'reduced']
export const DEFAULT_PARTY = { adult: 2, child: 2, reduced: 0 }
export const partySize = (p) => PARTY_CATS.reduce((n, c) => n + (p[c] || 0), 0)

// Is the family ticket in play for this screening? (child in the party,
// before 18:00, and a film the offer covers)
function familyApplies(cfg, minutes, party, fsk) {
  const ft = cfg.familyTicket
  if (!ft || !(party.child > 0) || minutes >= ft.before) return false
  return fsk == null || fsk <= ft.maxFsk
}

// What one visitor of `cat` pays for this screening: the cheapest ticket they
// may buy. With the family ticket active, adults and students may buy the
// child ticket too — that's where the saving comes from.
function bestTicket(cfg, cat, minutes, tier, family) {
  let best = null
  for (const tk of cfg.tickets) {
    if (minutes < tk.from || minutes >= tk.to) continue
    const eligible = tk.who === 'any' || tk.who === cat || (family && tk.who === 'child')
    if (!eligible) continue
    const p = tk.price[tier]
    if (p == null) continue
    if (!best || p < best.price) best = { ticket: tk, price: p }
  }
  return best
}

// Total for the whole party for one screening.
// → { total, tier, family, lines: [{ cat, count, each, ticket, viaFamily }] }
// null when nothing can be priced (e.g. an empty party).
export function showPrice(cfg, iso, party, { fsk = null, threeD = false } = {}) {
  const d = new Date(iso)
  const tier = dayTier(d)
  const minutes = d.getHours() * 60 + d.getMinutes()
  const family = familyApplies(cfg, minutes, party, fsk)
  const extra = threeD ? (cfg.threeD || 0) : 0
  const lines = []
  let total = 0
  for (const cat of PARTY_CATS) {
    const count = party[cat] || 0
    if (!count) continue
    const best = bestTicket(cfg, cat, minutes, tier, family)
    if (!best) return null
    lines.push({
      cat, count, each: best.price + extra, ticket: best.ticket,
      viaFamily: family && best.ticket.who === 'child' && cat !== 'child',
    })
    total += count * (best.price + extra)
  }
  if (!lines.length) return null
  return { total, tier, family, lines }
}

// --- exact prices ----------------------------------------------------------
// data/prices.json holds what the cinema's own ticket shop charges for each
// screening: {adult, child, reduced, family?, menu_child?, menu_family?,
// menu_holiday?, format?}. Film surcharge and format are already in there, so
// there is nothing left to model — just pick the cheapest ticket each visitor
// may buy. The Familienpreis is only listed on screenings where the cinema
// actually grants it, so its mere presence is the rule.
const OWN_PRICE = {
  adult: (ex) => ex.adult,
  child: (ex) => ex.child ?? ex.family ?? ex.adult,
  reduced: (ex) => ex.reduced ?? ex.adult,
}

export function showPriceExact(ex, party) {
  const family = (party.child || 0) > 0 && ex.family != null
  const lines = []
  let total = 0
  for (const cat of PARTY_CATS) {
    const count = party[cat] || 0
    if (!count) continue
    const options = [OWN_PRICE[cat](ex), family ? ex.family : null].filter((v) => v != null)
    if (!options.length) return null
    const each = Math.min(...options)
    lines.push({ cat, count, each, role: (family && each === ex.family && cat !== 'child') ? 'family' : cat })
    total += count * each
  }
  if (!lines.length) return null
  return { total, lines, family, exact: true, format: ex.format || null, menus: menuExtras(ex) }
}

// What a food bundle adds per ticket, e.g. "kids menu + 5,50 €"
function menuExtras(ex) {
  const base = ex.child ?? ex.family ?? ex.adult
  const out = {}
  if (ex.menu_child != null && base != null) out.child = round2(ex.menu_child - base)
  if (ex.menu_family != null && base != null) out.family = round2(ex.menu_family - base)
  return out
}
const round2 = (v) => Math.round(v * 100) / 100

// The performance id Kinopolis puts in its booking links — our join key
// between a showtime and data/prices.json
export const showId = (url) => (String(url || '').match(/vorstellung\/([A-Z0-9]{16,})/) || [])[1] || null

export function exactFor(live, show) {
  const id = showId(show.booking_url)
  return (id && live && live.cinemas && live.cinemas[show.cinema]
    && live.cinemas[show.cinema].shows[id]) || null
}

// One price for one screening: the cinema's own figure when we have it, our
// table otherwise. `movie` supplies the FSK the family rule needs.
export function priceFor(cfg, movie, show, party, opts, live) {
  const ex = exactFor(live, show)
  if (ex) return showPriceExact(ex, party)
  return showPrice(cfg, show.datetime, party, { ...opts, fsk: movie.age_rating })
}

// Cheapest total across a list of showtimes — used for the "ab X €" hints.
export function cheapestTotal(cfg, movie, shows, party, opts, live) {
  let min = null
  for (const s of shows) {
    const p = priceFor(cfg, movie, s, party, opts, live)
    if (p && (min == null || p.total < min)) min = p.total
  }
  return min
}

export const fmtEur = (v, locale = 'de-DE') =>
  v == null ? '–' : v.toLocaleString(locale, { style: 'currency', currency: 'EUR' })
