// --- ticket prices ---------------------------------------------------------
// Two sources feed this file, and they are not equal:
//
//   1. `data/prices.json` — what the cinema's own till charges for one exact
//      screening. Only the CineOrder shops give us that (Kinopolis Bad
//      Godesberg, Cinedom); see scraper/sources/cineorder.py. Film surcharge,
//      format and the family price are already in those numbers, so nothing is
//      left to model.
//   2. `CINEMA_PRICES` below — the printed price list of every other cinema,
//      typed off its own price page by hand and re-checked, hence the `checked`
//      date the UI always shows next to a link to that page.
//
// A printed list is only ever the FLOOR of what a screening costs: most houses
// add a film-related or overlength surcharge on top. Where the cinema states
// that rule numerically we compute it (`lengthSurcharge`); where it only gives
// a range we list it under `surcharges` and the UI marks the total "≈ geschätzt".
// Prices taken from a range in the price list use the LOWER end, because the UI
// says "ab X €" — from X euro.
//
// Adding a cinema = one more entry keyed by its exact name in movies.json.
//
// ---------------------------------------------------------------------------
// Shape of an entry
//
//   days      the cinema's own day tiers, IN ORDER; the first whose `match`
//             fits the date wins, so the last entry should be a catch-all
//             (`match` omitted). Every `price` array below is indexed by it.
//             A match clause: wd = weekdays (0 = Sunday), holiday = the date is
//             / is not a public holiday, eve = the day before is / is not one.
//             Several alternatives per tier are allowed (`match: [a, b]`).
//   tickets   who may buy it, when, and what it costs per day tier.
//             who: 'any'  — the price of the screening, anyone pays it
//                  'adult' / 'child' / 'reduced' — tied to the visitor.
//             An array of roles is allowed ('under 25' is both child and
//             reduced at several houses), and `[]` means nobody buys it on
//             their own — only the two family flags open it up:
//               family:     while the family fare applies, grown-ups may buy
//                           this row too (that IS the family saving)
//               familyOnly: the row only exists while the family fare applies
//             `null` = not sold in that tier. Times are minutes after midnight,
//             `to` exclusive (1020 = 17:00).
//   familyTicket  when the family fare applies. While it does, adults and
//             students may also buy the 'child' and 'family' tickets — that is
//             where the saving comes from.
//   displayOnly   shown in the price list, never auto-picked: fares that need a
//             specific programme (Kinderkino, Sneak) or a pass bought up front.
//   lengthSurcharge  thresholds in minutes → euro, highest match wins. Only
//             where the cinema publishes exact steps.
//   onlineFeePct  advance-sale fee added when booking online (Cinenova only).

// NRW public holidays — they carry Sunday prices almost everywhere, and at some
// houses the working day before one does too. Only the years the program reaches.
const HOLIDAYS_NRW = new Set([
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-14',
  '2026-05-25', '2026-06-04', '2026-10-03', '2026-11-01', '2026-12-25', '2026-12-26',
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-01', '2027-05-06',
  '2027-05-17', '2027-05-27', '2027-10-03', '2027-11-01', '2027-12-25', '2027-12-26',
])

const localDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const isHoliday = (d) => HOLIDAYS_NRW.has(localDay(d))
const isEve = (d) => HOLIDAYS_NRW.has(localDay(new Date(d.getTime() + 86400000)))

function clauseFits(c, d) {
  if (c.wd && !c.wd.includes(d.getDay())) return false
  if (c.holiday != null && isHoliday(d) !== c.holiday) return false
  if (c.eve != null && isEve(d) !== c.eve) return false
  return true
}

// Which of the cinema's day tiers this date falls in.
export function dayTier(cfg, d) {
  const days = cfg.days || []
  for (let i = 0; i < days.length; i++) {
    const m = days[i].match
    if (!m) return i                                    // catch-all
    if ((Array.isArray(m) ? m : [m]).some((c) => clauseFits(c, d))) return i
  }
  return Math.max(0, days.length - 1)
}

export const tierLabels = (cfg, ui) => (cfg.days || []).map((t) => (ui === 'en' ? t.en : t.de))

// --- shared wording --------------------------------------------------------
const GILDEPASS = {
  de: 'Gilde Pass — 10,00 € für ein Jahr, ermäßigt den Eintritt in Filmpalette, Filmhaus, Odeon, OFF Broadway, Weisshaus, Cinenova und Lichtspiele Kalk',
  en: 'Gilde Pass — €10.00 for a year, gives a reduction at Filmpalette, Filmhaus, Odeon, OFF Broadway, Weisshaus, Cinenova and Lichtspiele Kalk',
  url: 'https://www.agkino.de/gildepass/',
}
const NO_FEE = {
  de: 'Keine Vorverkaufsgebühr beim Onlinekauf',
  en: 'No booking fee when buying online',
}

export const CINEMA_PRICES = {
  // ---------------------------------------------------------------- Bonn ---
  'Woki': {
    checked: '2026-07-30',
    source: 'https://www.woki.de/unterseite/4217/Info',
    // The Woki deliberately publishes no standard price: "Klicke einfach auf die
    // gewünschte Vorstellungszeit und suche Dir einen beliebigen Sitzplatz aus.
    // So kannst Du sehen, was Deine Karte kostet." Only the Tuesday flat price
    // is stated unambiguously, so that is the only thing we price here — the
    // rest of their week stays out of the cheapest-first list rather than being
    // guessed at.
    note: {
      de: 'Das WOKI veröffentlicht keinen Normalpreis — der Preis steht erst bei der Sitzplatzwahl fest ("konkrete Endpreise"). Wir rechnen deshalb nur den Kino-Dienstag durch; alle anderen Vorstellungen zeigen wir bewusst ohne Preis.',
      en: 'The WOKI publishes no standard price — you only see it when you pick a seat ("final prices"). So we only calculate their Tuesday deal; every other screening is deliberately shown without a price.',
    },
    days: [
      { de: 'Di (Super-Kino-Dienstag)', en: 'Tue (cinema day)', match: [{ wd: [2], holiday: false, eve: false }] },
      { de: 'Alle anderen Tage', en: 'All other days' },
    ],
    tickets: [
      { id: 'tue', who: 'any', from: 0, to: 1440, price: [6.99, null],
        de: 'Alle 2D-Filme (Di)', en: 'All 2D films (Tue)' },
    ],
    displayOnly: [
      { de: 'Alle 3D-Filme am Kino-Dienstag', en: 'All 3D films on cinema Tuesday', flat: 9.99 },
      { de: 'Kinder- & Familienpreis bei Familienfilmen (2D, pro Person)', en: 'Child & family price for family films (2D, per person)', flat: 7.0 },
    ],
    surcharges: [
      { de: '3D beim Kinder- & Familienpreis', en: '3D on the child & family price', amount: 2.5 },
      { de: '3D-Brille an der Kasse (eigene Brille möglich)', en: '3D glasses at the counter (own glasses fine)', amount: 1.0 },
    ],
    familyTicket: {
      childUnder: 15, maxFsk: 12, familyFilmOnly: true,
      de: 'Bei Familienfilmen zahlen Kinder bis einschließlich 14 Jahren sowie je bis zu zwei erwachsene Begleitpersonen pro Kind den Kinder- und Familienpreis (z. B. 7,00 € bei 2D). Jede Person braucht ein eigenes Ticket.',
      en: 'For family films, children up to and including 14 and up to two accompanying adults per child pay the child & family price (e.g. €7.00 in 2D). Everyone needs their own ticket.',
    },
    offers: [
      { de: 'Kino-Dienstag: alle 2D-Filme 6,99 €, alle 3D-Filme 9,99 € (nicht vor und an Feiertagen, nicht bei Sondervorstellungen)',
        en: 'Cinema Tuesday: all 2D films €6.99, all 3D films €9.99 (not before or on public holidays, not for special screenings)',
        url: 'https://www.woki.de/unterseite/4217/Info' },
      { de: 'Ermäßigt: Kinder, Schüler:innen, Studierende, Bonn-Ausweis, KulturCard, Ehrenamtskarte, Azubis, Arbeitslose, Rentner:innen, Schwerbehinderte',
        en: 'Reduced: children, pupils, students, Bonn-Ausweis, KulturCard, Ehrenamtskarte, apprentices, unemployed, pensioners, disabled visitors',
        url: 'https://www.woki.de/unterseite/4217/Info' },
      { de: 'Der günstige Kinder- und Familienpreis gilt auch bei Kindergeburtstagen',
        en: 'The cheap child & family price also applies to kids birthday parties',
        url: 'https://www.woki.de/event/71367' },
    ],
  },

  'Rex Lichtspieltheater': {
    checked: '2026-07-30',
    source: 'https://www.rex-filmbuehne.de/inhalt/allgemeines/eintritt',
    days: [{ de: 'Alle Tage', en: 'All days' }],
    tickets: [
      { id: 'adult', who: 'adult', from: 0, to: 1440, price: [10.0],
        de: 'Normaler Eintrittspreis', en: 'Standard admission' },
      // Schüler are explicitly on the reduced list, so a school-age child pays
      // this at any film — the family fare below only ever undercuts it.
      { id: 'reduced', who: ['reduced', 'child'], from: 0, to: 1440, price: [9.0],
        de: 'Ermäßigt (Schüler, Studenten, Senioren ab 70, Bonnausweis, KulturCard, Schwerbehinderte, Azubis)',
        en: 'Reduced (pupils, students, seniors 70+, Bonnausweis, KulturCard, disabled visitors, apprentices)' },
      { id: 'family', who: 'child', family: true, familyOnly: true, from: 0, to: 1440, price: [7.5],
        de: 'Familienticket (alle Familienmitglieder)', en: 'Family ticket (every family member)' },
    ],
    lengthSurcharge: [{ from: 120, amount: 1.0 }],
    familyTicket: {
      childUnder: 15, maxFsk: 12, familyFilmOnly: true,
      de: 'Besucht eine Familie mit mindestens einem Kind bis 14 Jahre einen familientauglichen Film (FSK 0–12), kosten alle Tickets der Familie 7,50 €. Gilt auch für Repertoire-Kinderfilme (Sa/So nachmittags) und Familienfilme in Erstaufführung am Nachmittag.',
      en: 'If a family with at least one child up to 14 sees a family-friendly film (FSK 0–12), every ticket costs €7.50. Also applies to repertory kids films (Sat/Sun afternoons) and family films on afternoon first release.',
    },
    surcharges: [
      { de: 'Überlänge ab 120 Min. (mindestens)', en: 'Overlength from 120 min (at least)', amount: 1.0, atLeast: true },
    ],
    offers: [
      { de: 'Kinopass — kostenlose Stempelkarte, 10 Karten = 1 Freikarte',
        en: 'Kinopass — free stamp card, 10 tickets = 1 free ticket',
        url: 'https://www.rex-filmbuehne.de/inhalt/allgemeines/eintritt' },
    ],
  },

  'Bonner Kinemathek': {
    checked: '2026-07-30',
    source: 'https://neu.bonnerkinemathek.de/service/',
    days: [{ de: 'Alle Tage', en: 'All days' }],
    tickets: [
      { id: 'adult', who: 'adult', from: 0, to: 1440, price: [10.0],
        de: 'Normalpreis', en: 'Standard' },
      { id: 'reduced', who: ['reduced', 'child'], from: 0, to: 1440, price: [8.0],
        de: 'Ermäßigt (Gildepass, Schüler-, Studenten-, Schwerbehinderten- und Bonnausweis, KulturCard)',
        en: 'Reduced (Gildepass, pupil / student / disability / Bonn ID, KulturCard)' },
    ],
    // The 6,00 € fare hangs on the Kinemathek's "Kids-Veranstaltungen", a
    // programme strand our data cannot identify — FSK and genre alone would
    // have quoted it for a 21:30 screening. So it is listed, never calculated.
    displayOnly: [
      { de: 'Kids-Veranstaltung: Kinder + begleitende Erwachsene', en: 'Kids event: children + accompanying adults', flat: 6.0 },
      { de: 'Kids-Veranstaltung: Erwachsene ohne Begleitung eines Kindes', en: 'Kids event: adults not accompanying a child', flat: 8.0 },
    ],
    surcharges: [],
    note: {
      de: 'Die Kinemathek erhebt Zuschläge bei Überlänge, Gästen und Vorträgen, nennt dafür aber keine Beträge — die sind hier nicht eingerechnet.',
      en: 'The Kinemathek charges surcharges for overlength films, guests and talks but names no amounts — those are not included here.',
    },
    offers: [
      { de: 'Gutscheine für Kino in der Brotfabrik und LVR-LandesMuseum, Restbeträge bleiben nutzbar',
        en: 'Vouchers for Kino in der Brotfabrik and the LVR-LandesMuseum; remaining balance stays usable',
        url: 'https://neu.bonnerkinemathek.de/service/' },
    ],
  },

  'Stern Lichtspiele': {
    checked: '2026-07-30',
    source: 'https://www.cinestar.de/kino-bonn-sternlichtspiele/info/preise',
    days: [
      { de: 'Mo–Mi', en: 'Mon–Wed', match: [{ wd: [1, 2, 3], holiday: false }] },
      { de: 'Do–So & Feiertage', en: 'Thu–Sun & holidays' },
    ],
    tickets: [
      // CineStar sells no student fare here, so a student pays the adult price.
      { id: 'adult', who: ['adult', 'reduced'], from: 0, to: 1440, price: [11.9, 12.9],
        de: 'Erwachsene', en: 'Adults' },
      { id: 'child', who: 'child', from: 0, to: 1440, price: [7.5, 7.5],
        de: 'Kinder (bis einschl. 11 J., dienstags bis 15 J.)', en: 'Children (up to 11, on Tuesdays up to 15)' },
    ],
    surcharges: [
      { de: '3D-Film', en: '3D film', amount: 3.0 },
      { de: '3D-Brille', en: '3D glasses', amount: 1.0 },
      { de: 'Filmzuschlag', en: 'Film surcharge', amount: 3.0, upTo: true },
    ],
    threeD: 3.0,
    offers: [
      { de: 'Online kostet genauso viel wie an der Kinokasse — keine Mehrkosten',
        en: 'Online costs the same as at the box office — no extra charge',
        url: 'https://www.cinestar.de/kino-bonn-sternlichtspiele/info/preise' },
      { de: 'CineStarCARD (kostenlos): Kinotag dienstags bis zu 50 % sparen, 1 € Rabatt auf reguläre Filme, 2 € auf Events, Freitickets sammeln',
        en: 'CineStarCARD (free): cinema day on Tuesdays up to 50 % off, €1 off regular films, €2 off events, collect free tickets',
        url: 'https://www.cinestar.de/kino-bonn-sternlichtspiele/info/preise' },
    ],
  },

  'Kinopolis Bad Godesberg': {
    checked: '2026-07-25',
    source: 'https://www.kinopolis.de/bn/preise',
    offersUrl: 'https://www.kinopolis.de/bn/angebote',
    // The four columns of their printed table, in its own order — the arrays
    // follow its column spans exactly, e.g. the child price still holds on
    // Fridays while adult evening prices already jump.
    days: [
      { de: 'Mo–Do', en: 'Mon–Thu', match: [{ wd: [1, 2, 3, 4], holiday: false, eve: false }] },
      { de: 'Fr / vor Feiertagen', en: 'Fri / day before holiday',
        match: [{ wd: [5], holiday: false }, { wd: [1, 2, 3, 4], holiday: false, eve: true }] },
      { de: 'Sa', en: 'Sat', match: [{ wd: [6], holiday: false }] },
      { de: 'So & Feiertage', en: 'Sun & holidays' },
    ],
    tickets: [
      { id: 'matinee', who: 'any', from: 0, to: 720, price: [7.49, 7.49, 7.49, 9.49],
        de: 'Matinee (vor 12 Uhr)', en: 'Matinee (before 12:00)' },
      { id: 'happy', who: 'adult', from: 0, to: 1080, price: [9.49, 9.49, 12.49, 12.49],
        de: 'Happy Hour (vor 18 Uhr)', en: 'Happy hour (before 18:00)' },
      { id: 'adult', who: 'adult', from: 1080, to: 1440, price: [10.99, 13.49, 13.49, 13.49],
        de: 'Erwachsene (ab 18 Uhr)', en: 'Adults (from 18:00)' },
      { id: 'child', who: 'child', family: true, from: 0, to: 1080, price: [7.49, 7.49, 8.49, 8.49],
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
      before: 1080, childUnder: 12, maxFsk: 12, familyFilmOnly: true,
      de: 'In Begleitung eines Kindes unter 12 zahlen alle Familienangehörigen in Vorstellungen vor 18 Uhr den Kinderpreis (Kinder- und Familienfilme mit FSK 0, 6 oder 12; Sonderveranstaltungen ausgenommen, ggf. zzgl. Zuschläge).',
      en: 'Accompanying a child under 12, every family member pays the child price for screenings before 18:00 (kids/family films rated FSK 0, 6 or 12; special events excluded, surcharges may apply).',
    },
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

  // ---------------------------------------------------------------- Köln ---
  'Metropolis': {
    checked: '2026-07-30',
    source: 'https://metropolis-koeln.de/mehr/preise-ticket-price',
    days: [
      { de: 'Mo–Mi', en: 'Mon–Wed', match: [{ wd: [1, 2, 3], holiday: false }] },
      { de: 'Do (Kinotag)', en: 'Thu (cinema day)', match: [{ wd: [4], holiday: false }] },
      { de: 'Fr & Sa', en: 'Fri & Sat', match: [{ wd: [5, 6], holiday: false }] },
      { de: 'So & Feiertage', en: 'Sun & holidays' },
    ],
    tickets: [
      { id: 'day', who: 'any', from: 0, to: 1110, price: [7.0, 6.0, 9.0, 9.0],
        de: 'Jede Vorstellung (bis 18:30 Uhr)', en: 'Any screening (until 18:30)' },
      { id: 'evening', who: 'any', from: 1110, to: 1440, price: [7.0, 6.0, 9.0, 7.5],
        de: 'Jede Vorstellung (ab 18:30 Uhr)', en: 'Any screening (from 18:30)' },
      { id: 'kids', who: 'child', familyOnly: true, from: 0, to: 1440, price: [5.0, 5.0, 5.0, 5.0],
        de: 'Kinderticket (nur KiFi-Filme, bis einschl. 13 J.) — 5,00–5,50 €',
        en: 'Child ticket (KiFi films only, up to 13) — €5.00–5.50' },
      { id: 'family', who: [], family: true, familyOnly: true, from: 0, to: 1440, price: [6.0, 6.0, 6.0, 6.0],
        de: 'Familienticket für Begleitpersonen (nur KiFi-Filme) — 6,00–6,50 €',
        en: 'Family ticket for accompanying adults (KiFi films only) — €6.00–6.50' },
    ],
    displayOnly: [
      { de: 'Twentyfour-Ticket (13–24 J. mit Ausweis): 0,50–2,00 € Ermäßigung je nach Vorstellung', en: 'Twentyfour ticket (13–24 with ID): €0.50–2.00 off depending on the screening', flat: null },
      { de: 'soz. Gruppe (Institutionen der sozialen Betreuung, Voranmeldung per Mail)', en: 'Social-care institutions (register by e-mail in advance)', flat: 6.0 },
    ],
    surcharges: [
      { de: '3D', en: '3D', amount: 2.0 },
      { de: 'Überlänge', en: 'Overlength', amount: 0.5, to: 1.0 },
    ],
    threeD: 2.0,
    familyTicket: {
      childUnder: 14, maxFsk: 6, familyFilmOnly: true,
      de: 'Bei Filmen mit der Kennzeichnung KiFi zahlen Kinder bis einschließlich 13 Jahren 5,00–5,50 € und ihre erwachsenen Begleitpersonen 6,00–6,50 €.',
      en: 'For films marked KiFi, children up to and including 13 pay €5.00–5.50 and the adults accompanying them €6.00–6.50.',
    },
    note: {
      de: 'Kinder- und Familientickets gelten nur für Filme, die das Kino als KiFi kennzeichnet — das steht nicht in unseren Daten, wir nehmen ersatzweise Familienfilme mit FSK 0 oder 6 an. Preise für Specials können abweichen.',
      en: 'Child and family tickets only apply to films the cinema marks as KiFi, which our data does not record — we use family films rated FSK 0 or 6 as a stand-in. Prices for specials may differ.',
    },
    offers: [
      { de: 'Cineville-Abo — gilt auch im Metropolis', en: 'Cineville subscription — valid at the Metropolis too', url: 'https://www.cineville.de/' },
    ],
  },

  'Odeon': {
    checked: '2026-07-30',
    source: 'https://www.odeon-koeln.de/inhalt/allgemeines/eintritt',
    days: [
      { de: 'Do (Kinotag)', en: 'Thu (cinema day)', match: [{ wd: [4], holiday: false }] },
      { de: 'Alle anderen Tage', en: 'All other days' },
    ],
    tickets: [
      { id: 'kinotag', who: 'any', from: 0, to: 1440, price: [7.0, null],
        de: 'Kinotag Donnerstag — Einheitspreis', en: 'Cinema day Thursday — one price for all' },
      { id: 'adult', who: 'adult', from: 0, to: 1440, price: [null, 11.0],
        de: 'Normal', en: 'Standard' },
      { id: 'reduced', who: 'reduced', from: 0, to: 1440, price: [null, 9.0],
        de: 'Ermäßigt (Studenten, Schüler, Azubis, Schwerbehinderte, Köln- und Gildepass)',
        en: 'Reduced (students, pupils, apprentices, disabled visitors, Köln and Gilde pass)' },
      { id: 'youth', who: 'child', from: 0, to: 1440, price: [null, 6.0],
        de: 'Kinder- + Jugendticket (bis einschl. 16 J.)', en: 'Child + youth ticket (up to and including 16)' },
    ],
    displayOnly: [
      { de: 'Kinderprogramm: Erwachsene', en: 'Kids programme: adults', flat: 8.0 },
      { de: 'Seniorenkino (jeden 2. Mittwoch im Monat, 14:30 Uhr)', en: 'Seniors cinema (every 2nd Wednesday, 14:30)', flat: 7.0 },
      { de: 'Sneak-Preview (jeden 2. Mittwoch im Monat, 21:00 Uhr)', en: 'Sneak preview (every 2nd Wednesday, 21:00)', flat: 7.0 },
      { de: 'Exhibition on Screen (normal / ermäßigt 10,00 €)', en: 'Exhibition on Screen (standard / reduced €10.00)', flat: 12.0 },
    ],
    lengthSurcharge: [{ from: 120, amount: 0.5 }, { from: 135, amount: 1.0 }, { from: 150, amount: 2.0 }],
    surcharges: [
      { de: 'Überlänge ab 120 / 135 / 150 Min.', en: 'Overlength from 120 / 135 / 150 min', amount: 0.5, to: 2.0 },
    ],
    offers: [GILDEPASS],
  },

  'Filmpalette': {
    checked: '2026-07-30',
    source: 'http://www.filmpalette-koeln.de/das-kino.html',
    days: [{ de: 'Alle Tage', en: 'All days' }],
    tickets: [
      { id: 'adult', who: 'adult', from: 0, to: 1440, price: [10.0],
        de: 'Normal', en: 'Standard' },
      { id: 'reduced', who: 'reduced', from: 0, to: 1440, price: [9.0],
        de: 'Ermäßigt (Schüler, Studenten, Rentner, Köln-Pass, Gilde Pass)',
        en: 'Reduced (pupils, students, pensioners, Köln-Pass, Gilde Pass)' },
      { id: 'child', who: 'child', from: 0, to: 1440, price: [6.0],
        de: 'Kinder bis zum 12. Lebensjahr', en: 'Children up to 12' },
    ],
    displayOnly: [
      { de: 'Jugendliche vom 12. bis zum vollendeten 17. Lebensjahr', en: 'Teenagers from 12 up to 17', flat: 7.0 },
    ],
    surcharges: [],
    note: {
      de: 'Bei Filmen über 130 Minuten berechnet die Filmpalette einen Überlängen-Aufschlag, nennt dafür aber keinen Betrag — er ist hier nicht eingerechnet.',
      en: 'For films over 130 minutes the Filmpalette adds an overlength surcharge but names no amount — it is not included here.',
    },
    offers: [
      GILDEPASS,
      { de: 'Cineville-Card wird akzeptiert (Vorführungen anderer Veranstalter können ausgenommen sein)',
        en: 'Cineville card accepted (screenings by other organisers may be excluded)',
        url: 'https://www.cineville.de/' },
    ],
  },

  'OFF Broadway': {
    checked: '2026-07-30',
    source: 'https://www.off-broadway.de/unterseite/3533/Preise',
    days: [
      { de: 'Do (Kinotag)', en: 'Thu (cinema day)', match: [{ wd: [4], holiday: false, eve: false }] },
      { de: 'Fr–Mi & (Vor-)Feiertage', en: 'Fri–Wed & holidays (and the day before)' },
    ],
    tickets: [
      { id: 'adult', who: 'adult', from: 0, to: 1440, price: [9.0, 12.0],
        de: 'Normal', en: 'Standard' },
      // "Ermäßigungen gelten für alle unter 25-Jährigen" — so there is no
      // separate child fare here, children simply are the reduced category.
      { id: 'reduced', who: ['reduced', 'child'], from: 0, to: 1440, price: [7.5, 10.5],
        de: 'Ermäßigt (alle unter 25, Gilde-/Kölnpass, Menschen mit Behinderung)',
        en: 'Reduced (everyone under 25, Gilde/Köln pass, disabled visitors)' },
    ],
    displayOnly: [
      { de: 'Allerweltskino (normal / SoliTicket 9,00 €)', en: 'Allerweltskino (standard / soli ticket €9.00)', flat: 7.0 },
      { de: 'Filmpsychologische Betrachtungen — Unkostenbeitrag zusätzlich', en: 'Filmpsychologische Betrachtungen — extra contribution', flat: 1.0 },
    ],
    surcharges: [
      { de: 'Sonderveranstaltungen, hohe Lizenzkosten oder Überlänge ab 120 Min.', en: 'Special events, high licence costs or overlength from 120 min', amount: 1.0, to: 5.0 },
    ],
    offers: [
      NO_FEE,
      { de: 'Menschen mit Behinderung, die eine Begleitperson brauchen: Begleitperson frei',
        en: 'Disabled visitors who need a companion: the companion goes free',
        url: 'https://www.off-broadway.de/unterseite/3533/Preise' },
      GILDEPASS,
    ],
  },

  'Rex am Ring': {
    checked: '2026-07-30',
    source: 'https://rex-koeln.de/mehr/preise',
    days: [
      { de: 'Mo–Mi', en: 'Mon–Wed', match: [{ wd: [1, 2, 3], holiday: false }] },
      { de: 'Do (Kinotag)', en: 'Thu (cinema day)', match: [{ wd: [4], holiday: false }] },
      { de: 'Fr & Sa', en: 'Fri & Sat', match: [{ wd: [5, 6], holiday: false }] },
      { de: 'So & Feiertage', en: 'Sun & holidays' },
    ],
    tickets: [
      { id: 'day', who: 'any', from: 0, to: 1110, price: [7.0, 6.0, 9.0, 9.0],
        de: 'Jede Vorstellung (bis 18:30 Uhr)', en: 'Any screening (until 18:30)' },
      { id: 'evening', who: 'any', from: 1110, to: 1440, price: [7.0, 6.0, 9.0, 7.5],
        de: 'Jede Vorstellung (ab 18:30 Uhr)', en: 'Any screening (from 18:30)' },
      { id: 'kids', who: 'child', familyOnly: true, from: 0, to: 1440, price: [5.0, 5.0, 5.0, 5.0],
        de: 'Kinderticket (nur KiFi-Filme, bis einschl. 13 J.) — 5,00–5,50 €',
        en: 'Child ticket (KiFi films only, up to 13) — €5.00–5.50' },
      { id: 'family', who: [], family: true, familyOnly: true, from: 0, to: 1440, price: [6.0, 6.0, 6.0, 6.0],
        de: 'Familienticket für Begleitpersonen (nur KiFi-Filme) — 6,00–6,50 €',
        en: 'Family ticket for accompanying adults (KiFi films only) — €6.00–6.50' },
    ],
    displayOnly: [
      { de: 'Twentyfour-Ticket (13–24 J. mit Ausweis): 0,50–2,00 € Ermäßigung je nach Vorstellung', en: 'Twentyfour ticket (13–24 with ID): €0.50–2.00 off depending on the screening', flat: null },
      { de: 'soz. Gruppe (Institutionen der sozialen Betreuung, Voranmeldung per Mail)', en: 'Social-care institutions (register by e-mail in advance)', flat: 6.0 },
    ],
    surcharges: [
      { de: '3D', en: '3D', amount: 2.0 },
      { de: 'Überlänge', en: 'Overlength', amount: 0.5, to: 1.0 },
    ],
    threeD: 2.0,
    familyTicket: {
      childUnder: 14, maxFsk: 6, familyFilmOnly: true,
      de: 'Bei Filmen mit der Kennzeichnung KiFi zahlen Kinder bis einschließlich 13 Jahren 5,00–5,50 € und ihre erwachsenen Begleitpersonen 6,00–6,50 €.',
      en: 'For films marked KiFi, children up to and including 13 pay €5.00–5.50 and the adults accompanying them €6.00–6.50.',
    },
    note: {
      de: 'Kinder- und Familientickets gelten nur für Filme, die das Kino als KiFi kennzeichnet — das steht nicht in unseren Daten, wir nehmen ersatzweise Familienfilme mit FSK 0 oder 6 an. Preise für Specials können abweichen.',
      en: 'Child and family tickets only apply to films the cinema marks as KiFi, which our data does not record — we use family films rated FSK 0 or 6 as a stand-in. Prices for specials may differ.',
    },
    offers: [
      { de: 'Cineville-Abo — gilt auch im Rex am Ring', en: 'Cineville subscription — valid at the Rex am Ring too', url: 'https://www.cineville.de/' },
    ],
  },

  'Weisshaus Kino': {
    checked: '2026-07-30',
    source: 'https://www.weisshaus-kino.de/unterseite/3699/Preise',
    days: [
      { de: 'Do (Kinotag)', en: 'Thu (cinema day)', match: [{ wd: [4], holiday: false, eve: false }] },
      { de: 'Fr–Mi & (Vor-)Feiertage', en: 'Fri–Wed & holidays (and the day before)' },
    ],
    tickets: [
      { id: 'adult', who: 'adult', from: 0, to: 1440, price: [9.0, 12.0],
        de: 'Normal', en: 'Standard' },
      { id: 'reduced', who: ['reduced', 'child'], from: 0, to: 1440, price: [7.5, 10.5],
        de: 'Ermäßigt (alle unter 25, Gilde-/Kölnpass, Menschen mit Behinderung)',
        en: 'Reduced (everyone under 25, Gilde/Köln pass, disabled visitors)' },
    ],
    displayOnly: [
      { de: 'KidsKino (normal / ermäßigt 6,00 €)', en: 'KidsKino (standard / reduced €6.00)', flat: 7.5 },
      { de: 'Kinder- und Jugendfilme zum Bundesstart (normal / ermäßigt 8,00 €)', en: 'Kids and youth films on national release (standard / reduced €8.00)', flat: 9.5 },
      { de: 'SeniorenKino (1. Dienstag im Monat, 14:30 Uhr)', en: 'Seniors cinema (1st Tuesday of the month, 14:30)', flat: 7.0 },
    ],
    surcharges: [
      { de: 'Sonderveranstaltungen, hohe Lizenzkosten oder Überlänge ab 120 Min.', en: 'Special events, high licence costs or overlength from 120 min', amount: 1.0, to: 5.0 },
    ],
    note: {
      de: 'KidsKino und Kinder-/Jugendfilme zum Bundesstart sind deutlich günstiger, hängen aber an der Programmreihe — die steht nicht in unseren Daten, deshalb rechnen wir mit dem regulären Preis.',
      en: 'KidsKino and kids/youth films on national release are much cheaper, but depend on the programme strand, which our data does not record — so we calculate with the regular price.',
    },
    offers: [
      NO_FEE,
      { de: 'Menschen mit Behinderung, die eine Begleitperson brauchen: Begleitperson frei',
        en: 'Disabled visitors who need a companion: the companion goes free',
        url: 'https://www.weisshaus-kino.de/unterseite/3699/Preise' },
      GILDEPASS,
    ],
  },

  'Lichtspiele Kalk': {
    checked: '2026-07-30',
    source: 'https://www.lichtspiele-kalk.de/preise/',
    days: [
      { de: 'Do (Kinotag)', en: 'Thu (cinema day)', match: [{ wd: [4], holiday: false }] },
      { de: 'Fr–Mi & Feiertage', en: 'Fri–Wed & holidays' },
    ],
    tickets: [
      { id: 'adult', who: 'adult', from: 0, to: 1440, price: [8.0, 10.0],
        de: 'Normal', en: 'Standard' },
      { id: 'reduced', who: ['reduced', 'child'], from: 0, to: 1440, price: [7.0, 9.0],
        de: 'Ermäßigt −1,00 € (Studium, Ausbildung, Schule, FSJ, unter 25, Gildepass)',
        en: 'Reduced −€1.00 (studying, training, school, FSJ, under 25, Gildepass)' },
    ],
    displayOnly: [
      { de: 'Köln-Pass', en: 'Köln-Pass', flat: 5.0 },
      { de: 'Kinder- & Jugendfilme: Kinder und Jugendliche bis einschl. 18 J. (Köln-Pass 4,00 €)', en: 'Kids & youth films: children and teenagers up to 18 (Köln-Pass €4.00)', flat: 4.5 },
      { de: 'Kinder- & Jugendfilme: erwachsene Begleitpersonen (ermäßigt 5,50 €)', en: 'Kids & youth films: accompanying adults (reduced €5.50)', flat: 6.5 },
      { de: 'Cinemania Kalk, something weird cinema und alle weiteren Specials', en: 'Cinemania Kalk, something weird cinema and all other specials', flat: 10.0 },
    ],
    lengthSurcharge: [{ from: 140, amount: 1.0 }, { from: 150, amount: 1.5 }, { from: 160, amount: 2.0 }],
    surcharges: [
      { de: 'Überlänge ab 140 / 150 / 160 Min.', en: 'Overlength from 140 / 150 / 160 min', amount: 1.0, to: 2.0 },
    ],
    note: {
      de: 'Die deutlich günstigeren Preise des Kinder- & Jugendprogramms hängen an der Programmreihe, die unsere Daten nicht kennen — wir rechnen mit dem regulären ermäßigten Preis. Es gilt immer nur ein Ermäßigungsgrund.',
      en: 'The much cheaper kids & youth programme prices depend on the programme strand, which our data does not know — we calculate with the regular reduced price. Only one reduction applies at a time.',
    },
    offers: [
      { de: 'Cineville Kino-Abo — ab 20,00 € im Monat beliebig oft ins Kino',
        en: 'Cineville subscription — from €20.00 a month, as often as you like',
        url: 'https://www.cineville.de/' },
      GILDEPASS,
      { de: 'Schwerbehindertenausweis mit Merkzeichen B: Begleitperson frei',
        en: 'Disability card marked "B": the companion goes free',
        url: 'https://www.lichtspiele-kalk.de/preise/' },
    ],
  },

  'Cinenova': {
    checked: '2026-07-30',
    source: 'https://www.cinenova.de/preise-cinecard/',
    days: [{ de: 'Mo–So', en: 'Mon–Sun' }],
    tickets: [
      { id: 'adult', who: 'adult', from: 0, to: 1440, price: [10.0],
        de: 'Normal', en: 'Standard' },
      { id: 'reduced', who: ['reduced', 'child'], from: 0, to: 1440, price: [9.0],
        de: 'Sonderpreis (Schüler, Studenten, Schwerbehinderte, Köln- und Gildepass)',
        en: 'Special price (pupils, students, disabled visitors, Köln and Gilde pass)' },
    ],
    displayOnly: [
      { de: 'Cinecard (Kundenkarte, ohne Vorverkaufsgebühr)', en: 'Cinecard (loyalty card, no booking fee)', flat: 8.5 },
      { de: 'Kinderfilme — Festpreis', en: 'Kids films — flat price', flat: 7.0 },
      { de: 'Seniorenkino (dienstags mittags)', en: 'Seniors cinema (Tuesday middays)', flat: 8.0 },
      { de: 'Heimkino (mittwochs, Klassiker in OmdU/OV)', en: 'Heimkino (Wednesdays, classics in OmdU/OV)', flat: 8.0 },
      { de: 'Sneak-Preview (jeden 2. Dienstag)', en: 'Sneak preview (every 2nd Tuesday)', flat: 8.0 },
    ],
    lengthSurcharge: [{ from: 120, amount: 1.0 }, { from: 160, amount: 2.0 }],
    onlineFeePct: 10,
    surcharges: [
      { de: 'Überlänge ab 120 Min.', en: 'Overlength from 120 min', amount: 1.0 },
      { de: 'Überlänge ab 160 Min.', en: 'Overlength from 160 min', amount: 2.0 },
      { de: 'Vorverkaufsgebühr beim Onlinekauf (10 %, nicht mit Cinecard)', en: 'Online booking fee (10 %, not with the Cinecard)', amount: 0, pct: 10 },
    ],
    note: {
      de: 'Cinenova schlägt beim Onlinekauf 10 % Vorverkaufsgebühr auf — die ist hier eingerechnet. Mit der Cinecard entfällt sie.',
      en: 'Cinenova adds a 10 % booking fee online — it is included here. The Cinecard waives it.',
    },
    offers: [
      { de: 'Cinecard — kostenlose Kundenkarte: 8,50 € pro Ticket und keine Vorverkaufsgebühr',
        en: 'Cinecard — free loyalty card: €8.50 a ticket and no booking fee',
        url: 'https://www.cinenova.de/preise-cinecard/' },
      { de: 'Kindergeburtstage im Cinenova', en: 'Kids birthdays at the Cinenova', url: 'https://www.cinenova.de/kindergeburtstag/' },
      { de: 'Kooperationspartner von Cineville und Mubi-Go', en: 'Partner cinema for Cineville and Mubi-Go', url: 'https://www.cineville.de/' },
    ],
  },

  'Kölner Filmhaus': {
    checked: '2026-07-30',
    source: 'https://filmhaus-koeln.de/kino#ticketpreise',
    days: [{ de: 'Alle Tage', en: 'All days' }],
    tickets: [
      { id: 'adult', who: 'adult', from: 0, to: 1440, price: [9.0],
        de: 'Normalpreis', en: 'Standard' },
      { id: 'u25', who: ['reduced', 'child'], from: 0, to: 1440, price: [7.0],
        de: 'Zuschauer:innen bis 24 Jahre', en: 'Visitors up to 24' },
    ],
    displayOnly: [
      { de: 'Köln- und Gildepass-Inhaber:innen', en: 'Köln and Gilde pass holders', flat: 8.0 },
    ],
    surcharges: [],
    offers: [
      { de: 'Cineville-Abo — so oft ins Filmhaus Kino, wie du willst',
        en: 'Cineville subscription — the Filmhaus Kino as often as you like',
        url: 'https://filmhaus-koeln.de/post/mit-cineville-ins-filmhaus-kino' },
      GILDEPASS,
    ],
  },

  'Cineplex Köln': {
    checked: '2026-07-30',
    source: 'https://www.cineplex.de/koeln/cineplex-koeln/infos-und-preise',
    days: [
      { de: 'Mo–Do', en: 'Mon–Thu', match: [{ wd: [1, 2, 3, 4], holiday: false, eve: false }] },
      { de: 'Fr & Sa', en: 'Fri & Sat', match: [{ wd: [5, 6], holiday: false, eve: false }] },
      { de: 'So & (Vor-)Feiertage', en: 'Sun & holidays (and the day before)' },
    ],
    tickets: [
      { id: 'day', who: ['adult', 'reduced'], from: 0, to: 1020, price: [10.0, 11.0, 11.0],
        de: 'Vor 17 Uhr', en: 'Before 17:00' },
      { id: 'evening', who: ['adult', 'reduced'], from: 1020, to: 1440, price: [10.0, 12.0, 12.0],
        de: 'Ab 17 Uhr', en: 'From 17:00' },
      { id: 'student', who: 'reduced', from: 0, to: 1440, price: [8.5, null, null],
        de: 'Schüler & Studenten Mo–Do (−1,50 €, mit Ausweis)', en: 'Pupils & students Mon–Thu (−€1.50, with ID)' },
      { id: 'student_late', who: 'reduced', from: 1320, to: 1440, price: [null, 10.5, null],
        de: 'Schüler & Studenten Fr + Sa ab 22 Uhr (−1,50 €)', en: 'Pupils & students Fri + Sat from 22:00 (−€1.50)' },
      { id: 'child', who: 'child', family: true, from: 0, to: 1440, price: [7.9, 7.9, 7.9],
        de: 'Kinder (bis einschl. 11 J.) & Familientarif', en: 'Children (up to and including 11) & family tariff' },
      { id: 'matinee', who: 'any', from: 0, to: 840, price: [null, null, 7.9],
        de: 'Matinee vor 14 Uhr (Sonn- und Feiertags)', en: 'Matinee before 14:00 (Sundays and holidays)' },
    ],
    displayOnly: [
      { de: 'Senioren-Kino', en: 'Seniors cinema', flat: 8.0 },
      { de: 'Best of Cinema / CineArt', en: 'Best of Cinema / CineArt', flat: 10.0 },
      { de: 'Anime Night (12,00–15,00 €)', en: 'Anime night (€12.00–15.00)', flat: 12.0 },
      { de: 'Royal Ballet & Opera (26,00 / 28,00 €)', en: 'Royal Ballet & Opera (€26.00 / €28.00)', flat: 26.0 },
      { de: 'MET Opera (Abo 33,50 €)', en: 'MET Opera (subscription €33.50)', flat: 36.5 },
    ],
    lengthSurcharge: [
      { from: 130, amount: 1.0 }, { from: 140, amount: 1.5 }, { from: 150, amount: 2.0 },
      { from: 165, amount: 2.5 }, { from: 180, amount: 4.0 },
    ],
    surcharges: [
      { de: 'Loge', en: 'Loge', amount: 2.0 },
      { de: '3D', en: '3D', amount: 3.0 },
      { de: 'Überlänge ab 130 / 140 / 150 / 165 / 180 Min.', en: 'Overlength from 130 / 140 / 150 / 165 / 180 min', amount: 1.0, to: 4.0 },
      { de: 'D-BOX (ausgewählte Filme in Kino 1 und 3)', en: 'D-BOX (selected films in screens 1 and 3)', amount: 8.0 },
      { de: 'Dolby Atmos (ausgewählte Filme in Kino 1, 3 und 7)', en: 'Dolby Atmos (selected films in screens 1, 3 and 7)', amount: 1.0 },
    ],
    threeD: 3.0,
    familyTicket: {
      before: 1020, wd: [6], childUnder: 12, maxFsk: 6,
      de: 'Samstags vor 17 Uhr zahlen bei Filmen mit FSK 0 oder FSK 6 alle Familienangehörigen in Begleitung eines Kindes unter 12 Jahren den Kinderpreis von 7,90 €.',
      en: 'On Saturdays before 17:00, for films rated FSK 0 or 6, every family member accompanying a child under 12 pays the €7.90 child price.',
    },
    offers: [
      { de: 'Cineplex PLUS — Vorteilsprogramm des Kinos', en: 'Cineplex PLUS — the cinema’s loyalty programme', url: 'https://www.cineplex.de/koeln/' },
    ],
  },

  'Cinedom': {
    checked: '2026-07-30',
    source: 'https://cinedom.de/kinobesuch-planen/preise/',
    // Cinedom's own shop gives us the exact price of nearly every screening
    // (data/prices.json), so this table is only the fallback for the few it
    // does not cover — their printed prices are all "ab" figures anyway.
    days: [
      { de: 'Mo–Do', en: 'Mon–Thu', match: [{ wd: [1, 2, 3, 4], holiday: false }] },
      { de: 'Fr–So & Feiertage', en: 'Fri–Sun & holidays' },
    ],
    tickets: [
      { id: 'modo', who: ['adult', 'reduced'], from: 0, to: 1440, price: [8.0, null],
        de: 'Montag–Donnerstag', en: 'Monday–Thursday' },
      { id: 'day', who: ['adult', 'reduced'], from: 0, to: 1020, price: [null, 9.0],
        de: 'Fr–So & Feiertage, vor 17 Uhr', en: 'Fri–Sun & holidays, before 17:00' },
      { id: 'evening', who: ['adult', 'reduced'], from: 1020, to: 1440, price: [null, 10.0],
        de: 'Fr–So & Feiertage, ab 17 Uhr', en: 'Fri–Sun & holidays, from 17:00' },
      { id: 'reduced', who: 'reduced', from: 0, to: 1020, price: [7.0, null],
        de: 'Ermäßigt Mo–Do vor 17 Uhr (nur an der Kasse!)', en: 'Reduced Mon–Thu before 17:00 (box office only!)' },
      { id: 'child', who: 'child', family: true, from: 0, to: 1440, price: [7.0, 7.0],
        de: 'Kinder bis einschl. 11 J. & Familientarif', en: 'Children up to and including 11 & family tariff' },
    ],
    lengthSurcharge: [{ from: 120, amount: 0.5 }, { from: 140, amount: 1.0 }, { from: 160, amount: 1.5 }],
    surcharges: [
      { de: '3D', en: '3D', amount: 3.0 },
      { de: 'Atmos (Kino 4, 9 + BlackBox)', en: 'Atmos (screens 4, 9 + BlackBox)', amount: 1.0 },
      { de: 'Loge', en: 'Loge', amount: 2.0 },
      { de: 'VIP-Sitze (Kino 9 + BlackBox)', en: 'VIP seats (screen 9 + BlackBox)', amount: 2.5 },
      { de: 'Luxussäle (Kino 10–13)', en: 'Luxury screens (10–13)', amount: 3.5 },
      { de: 'HFR', en: 'HFR', amount: 1.0 },
      { de: 'HDR', en: 'HDR', amount: 2.5 },
      { de: 'Blockbusterzuschlag', en: 'Blockbuster surcharge', amount: 1.5, to: 2.0 },
      { de: 'Überlänge ab 120 / 140 / 160 Min.', en: 'Overlength from 120 / 140 / 160 min', amount: 0.5, to: 1.5 },
    ],
    threeD: 3.0,
    familyTicket: {
      before: 1020, childUnder: 12, maxFsk: 6, maxAdults: 2,
      de: 'Bis zu zwei Elternteile zahlen vor 17 Uhr nur den Kinderpreis, in Begleitung mindestens eines Kindes bis einschließlich 11 Jahren, für alle Sitzplatz- und Saalkategorien und nur bei FSK 0 und FSK 6. Nachweis erforderlich.',
      en: 'Up to two parents pay only the child price before 17:00, accompanying at least one child up to and including 11, in every seat and screen category and only for FSK 0 and FSK 6 films. Proof required.',
    },
    note: {
      de: 'Der ermäßigte Preis wird nur an der Kinokasse gegen Ausweis gewährt — online verkauft Cinedom ihn nicht, dort zahlen Studierende und Schüler:innen den Normalpreis.',
      en: 'The reduced fare is granted only at the box office on presentation of an ID — Cinedom does not sell it online, where students and pupils pay the standard price.',
    },
    offers: [
      { de: 'Begleitpersonen von Gästen mit Merkzeichen B: Freikarte an der Kartenkasse',
        en: 'Companions of guests whose disability card is marked "B": free ticket at the box office',
        url: 'https://cinedom.de/kinobesuch-planen/preise/' },
    ],
  },
}

// The Neue Filmbühne shares operator, price page and price list with the Rex
// in Bonn-Beuel — same table, its own name in movies.json.
CINEMA_PRICES['Neue Filmbühne'] = { ...CINEMA_PRICES['Rex Lichtspieltheater'] }

export const hasPrices = (cinema) => !!CINEMA_PRICES[cinema]

export const PARTY_CATS = ['adult', 'child', 'reduced']
export const DEFAULT_PARTY = { adult: 2, child: 2, reduced: 0 }
export const partySize = (p) => PARTY_CATS.reduce((n, c) => n + (p[c] || 0), 0)

// Is the family fare in play for this screening? (a child in the party, inside
// the offer's day and time window, and a film the offer covers)
//
// A film whose FSK we don't know does NOT qualify. Every one of these offers is
// tied to a rating ("nur für FSK 0 + FSK 6"), and treating an unrated film as
// eligible is the expensive way to be wrong: it quoted a family the child price
// for Vaterland and a horror sequel, both of which simply have no rating in our
// data. Losing the offer on a genuine kids film only ever shows a price that is
// too high, which the panel already marks "≈ geschätzt".
function familyApplies(cfg, d, minutes, party, fsk, genres) {
  const ft = cfg.familyTicket
  if (!ft || !(party.child > 0)) return false
  if (ft.before != null && minutes >= ft.before) return false
  if (ft.wd && !ft.wd.includes(d.getDay())) return false
  if (fsk == null || fsk > ft.maxFsk) return false
  // Some houses tie the offer to a kids/family film on top of the rating
  // ("Kinder- und Familienfilme", "Filme mit Kennzeichnung KiFi"). A low rating
  // alone is not that: "Liebe braucht keine Ferien" is FSK 0 and no more a
  // children's film than any other rom-com. Where the cinema's wording is
  // purely about the rating (Cinedom, Cineplex) this flag stays off.
  if (ft.familyFilmOnly) return (genres || []).some((g) => FAMILY_GENRES.has(g))
  return true
}
const FAMILY_GENRES = new Set(['Familie', 'Animation'])

const roles = (tk) => (Array.isArray(tk.who) ? tk.who : [tk.who])

// What one visitor of `cat` pays for this screening: the cheapest ticket they
// may buy. While the family fare applies, grown-ups may also buy the rows
// flagged `family` — that's where the saving comes from.
function bestTicket(cfg, cat, minutes, tier, family) {
  let best = null
  for (const tk of cfg.tickets) {
    if (minutes < tk.from || minutes >= tk.to) continue
    if (tk.familyOnly && !family) continue
    const who = roles(tk)
    const eligible = who.includes('any') || who.includes(cat) ||
      (family && tk.family && cat !== 'child')
    if (!eligible) continue
    const p = tk.price[tier]
    if (p == null) continue
    if (!best || p < best.price) best = { ticket: tk, price: p, viaFamily: !who.includes(cat) && !who.includes('any') }
  }
  return best
}

// What the cinema's published overlength rule adds for a film of this length.
function lengthExtra(cfg, runtime) {
  if (!cfg.lengthSurcharge || !runtime) return 0
  let extra = 0
  for (const step of cfg.lengthSurcharge) if (runtime >= step.from) extra = step.amount
  return extra
}

// Total for the whole party for one screening.
// → { total, tier, family, lines: [{ cat, count, each, ticket, viaFamily }] }
// null when nothing can be priced (e.g. an empty party, or a cinema that
// publishes no price for that day).
export function showPrice(cfg, iso, party, { fsk = null, threeD = false, runtime = null, genres = null } = {}) {
  const d = new Date(iso)
  const tier = dayTier(cfg, d)
  const minutes = d.getHours() * 60 + d.getMinutes()
  const family = familyApplies(cfg, d, minutes, party, fsk, genres)
  const extra = (threeD ? (cfg.threeD || 0) : 0) + lengthExtra(cfg, runtime)
  const fee = (cfg.onlineFeePct || 0) / 100
  // some houses cap how many grown-ups the family fare covers
  let famLeft = cfg.familyTicket?.maxAdults ?? Infinity
  const lines = []
  let total = 0
  for (const cat of PARTY_CATS) {
    let count = party[cat] || 0
    if (!count) continue
    const add = (n, useFamily) => {
      const best = bestTicket(cfg, cat, minutes, tier, useFamily)
      if (!best) return false
      const each = round2((best.price + extra) * (1 + fee))
      lines.push({ cat, count: n, each, ticket: best.ticket, viaFamily: useFamily && best.viaFamily })
      total += n * each
      return true
    }
    if (family && cat !== 'child' && famLeft < count) {
      // split the line: the covered grown-ups, then the rest at full price
      if (famLeft > 0 && !add(famLeft, true)) return null
      const rest = count - Math.max(0, famLeft)
      famLeft = 0
      if (rest > 0 && !add(rest, false)) return null
      continue
    }
    if (family && cat !== 'child') famLeft -= count
    if (!add(count, family)) return null
  }
  if (!lines.length) return null
  return { total: round2(total), tier, family, lines }
}

// --- exact prices ----------------------------------------------------------
// data/prices.json holds what the cinema's own ticket shop charges for each
// screening: {adult, child, reduced, family?, menu_child?, menu_family?,
// menu_holiday?, format?}. Film surcharge and format are already in there, so
// there is nothing left to model — just pick the cheapest ticket each visitor
// may buy. The family price is only listed on screenings where the cinema
// actually grants it, so its mere presence is the rule.
const OWN_PRICE = {
  adult: (ex) => ex.adult,
  child: (ex) => ex.child ?? ex.family ?? ex.adult,
  reduced: (ex) => ex.reduced ?? ex.adult,
}

export function showPriceExact(ex, party, maxFamilyAdults = Infinity) {
  const family = (party.child || 0) > 0 && ex.family != null
  let famLeft = maxFamilyAdults
  const lines = []
  let total = 0
  for (const cat of PARTY_CATS) {
    const count = party[cat] || 0
    if (!count) continue
    const own = OWN_PRICE[cat](ex)
    if (own == null && !family) return null
    const push = (n, useFamily) => {
      const options = [own, useFamily ? ex.family : null].filter((v) => v != null)
      if (!options.length) return false
      const each = Math.min(...options)
      lines.push({ cat, count: n, each, role: (useFamily && each === ex.family && cat !== 'child') ? 'family' : cat })
      total += n * each
      return true
    }
    // the child is always covered; the cap only limits accompanying grown-ups
    const capped = family && cat !== 'child' && famLeft < count
    if (capped) {
      if (famLeft > 0 && !push(famLeft, true)) return null
      const rest = count - Math.max(0, famLeft)
      famLeft = 0
      if (rest > 0 && !push(rest, false)) return null
      continue
    }
    if (family && cat !== 'child') famLeft -= count
    if (!push(count, family)) return null
  }
  if (!lines.length) return null
  return { total: round2(total), lines, family, exact: true, format: ex.format || null, menus: menuExtras(ex) }
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

// The performance id the cinema's own booking link carries — our join key
// between a showtime and data/prices.json. Kinopolis puts it in the path
// (…/vorstellung/<id>), Cinedom in a query parameter (…?performance=<id>).
export const showId = (url) => {
  const s = String(url || '')
  const m = s.match(/vorstellung\/([A-Z0-9]{16,})/) || s.match(/[?&]performance=([A-Z0-9]{16,})/)
  return m ? m[1] : null
}

export function exactFor(live, show) {
  const id = showId(show.booking_url)
  return (id && live && live.cinemas && live.cinemas[show.cinema]
    && live.cinemas[show.cinema].shows[id]) || null
}

// One price for one screening: the cinema's own figure when we have it, our
// table otherwise. `movie` supplies the FSK and runtime the rules need.
export function priceFor(cfg, movie, show, party, opts, live) {
  const ex = exactFor(live, show)
  if (ex) {
    const cap = live?.cinemas?.[show.cinema]?.family_max_adults ?? Infinity
    return showPriceExact(ex, party, cap)
  }
  return showPrice(cfg, show.datetime, party,
    { ...opts, fsk: movie.age_rating, runtime: movie.runtime, genres: movie.genres })
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
