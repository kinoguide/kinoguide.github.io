import { memo, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  CINEMA_PRICES, tierLabels, DEFAULT_PARTY, priceFor, cheapestTotal,
  partySize, fmtEur,
} from './prices'

// --- i18n ------------------------------------------------------------------
const T = {
  de: {
    locale: 'de-DE',
    search: 'Filme suchen…',
    kids: '🧒 Kinderfilme',
    kidsTitle: 'Filme für Familien mit Kindern von 6 bis 12',
    clearSearch: 'Suche löschen',
    lastMinute: '⏰ Last Minute',
    lastMinuteTitle: 'Filme, die jetzt oder in den nächsten 4 Stunden starten',
    filter: 'Filter',
    sortLabel: 'Sortieren:',
    sortNew: 'Neu',
    sortAlpha: 'A–Z',
    reviews: 'Bewertungen',
    resetAll: 'Zurücksetzen',
    backHome: 'Zur Startseite',
    backToList: '← Zurück zur Übersicht',
    backToTop: 'Nach oben',
    activeFilters: 'Aktive Filter',
    clearOne: (l) => `Filter „${l}“ entfernen`,
    filterCount: (n) => `${n} aktiv`,
    groupWhen: 'Wann',
    groupWhere: 'Wo',
    groupWhat: 'Was',
    groupRating: 'Bewertung',
    showtimesLabel: 'Vorstellungen',
    hiddenShows: (n) => `${n} weitere ${n === 1 ? 'Vorstellung ist' : 'Vorstellungen sind'} ausgeblendet — alle zeigen`,
    hiddenShowsOff: 'Nur passende Vorstellungen zeigen',
    noShowsHere: 'Für diese Filter gibt es gerade keine Vorstellung.',
    notFound: 'Diesen Film finden wir gerade nicht im Programm.',
    bothCities: 'Beide',
    cityAll: 'Beide Städte',
    quickFilters: 'Schnellfilter',
    moreFilters: 'Mehr Filter',
    nextWeek: 'Nächste Woche',
    favorites: 'Favoriten',
    films: 'Filme',
    stand: 'Stand',
    genres: 'Genres',
    version: 'Fassung',
    allVersions: 'Alle Fassungen',
    germanVersion: 'Deutsch',
    cinemaLabel: 'Kino',
    allCinemas: 'Alle Kinos',
    dateLabel: 'Datum',
    allDays: 'Alle Tage',
    imdbMin: 'IMDb mindestens:',
    anyRating: 'egal',
    timeLabel: 'Uhrzeit:',
    reset: 'Filter zurücksetzen',
    today: 'Heute',
    tomorrow: 'Morgen',
    loading: 'Lade Programm…',
    loadError: (e) => `Programm konnte nicht geladen werden (${e}).`,
    empty: 'Keine Filme für diese Filter. Setz die Filter zurück, um alles zu sehen.',
    trailerDe: '▶ Trailer (Deutsch)',
    trailerOrig: '▶ Trailer (Original)',
    trailerOnly: '▶ Trailer',
    imdbLink: 'Auf IMDb ansehen',
    metaLink: 'Auf Metacritic suchen',
    lbLink: 'Auf Letterboxd ansehen',
    favOn: 'Aus Favoriten entfernen',
    favOff: 'Als Favorit merken',
    langBadgeDe: 'Deutsch',
    topicsLabel: 'Themen',
    topics: {
      women_directed: '♀ Regie: Frauen',
      queer: '🏳️‍🌈 Queer',
      international: '🌍 International',
    },
    origLangLabel: 'Originalsprache',
    origLabel: 'Original',
    countryLabel: 'Land',
    director: 'Regie',
    footer: 'Bewertungen: IMDb & Metascore via OMDb, Metadaten & FSK via TMDB. Themen- und Sprachfilter basieren auf TMDB-Daten (Originalsprache, Regie, Verschlagwortung) — sie zeigen Filme auf, sind aber nicht vollständig. OV/OmU wird aus den Kino-Angaben erkannt; einige Programmkinos kennzeichnen Originalfassungen nicht immer.',
    thanksPre: 'Inspiriert von Steven Kocadags wunderbarem',
    thanksPost: 'für Berlin — danke! 🧡',
    tickets: 'Tickets',
    ticketsTitle: 'Tickets beim Kino kaufen',
    info: 'Infos',
    infoTitle: 'Zur Seite des Kinos — dort steht, wie du reinkommst',
    contact: 'Kontakt & Impressum',
    contactBtn: 'Feedback & Impressum',
    contactIntro: 'Kino Köln · Bonn ist ein privates, nicht-kommerzielles Hobbyprojekt: keine Werbung, keine Tracker, keine Cookies.',
    feedbackTitle: 'Feedback',
    feedbackText: 'Fehlt ein Kino? Ist eine Uhrzeit oder eine Fassung (OV/OmU) falsch? Stimmt ein Preis nicht, oder fehlt eine Funktion? Ich freue mich über jede Rückmeldung. Schreib einfach hier: anonym oder unter Angabe deiner Mail, wenn du eine Antwort möchtest.',
    feedbackHint: 'Hilfreich ist: Kino, Film, Datum und was stattdessen richtig wäre.',
    mailBtn: '✉ E-Mail schreiben',
    fbLabel: 'Deine Nachricht',
    fbPlaceholder: 'Was ist falsch, was fehlt, was wünschst du dir?',
    fbNext: 'Weiter',
    fbEmpty: 'Bitte schreib zuerst eine Nachricht.',
    fbAskTitle: 'Möchtest du eine Antwort?',
    fbAskText: 'Dann hinterlass deine E-Mail-Adresse — sonst geht die Nachricht anonym raus. Die Adresse wird nur für die Antwort benutzt.',
    fbEmailPh: 'deine@adresse.de (optional)',
    fbEmailBad: 'Diese E-Mail-Adresse sieht nicht richtig aus.',
    fbSendAnon: 'Anonym senden',
    fbSendReply: 'Mit E-Mail senden',
    fbBack: '← Nachricht ändern',
    fbSending: 'Wird gesendet …',
    fbDone: 'Danke! Deine Nachricht ist angekommen. 🧡',
    fbDoneReply: 'Ich melde mich, sobald ich dazu komme.',
    fbAgain: 'Noch eine Nachricht schreiben',
    fbFail: 'Das hat leider nicht geklappt. Versuch es später noch einmal — oder schreib direkt an:',
    fbService: 'Das Formular läuft über den Dienst FormSubmit (formsubmit.co), der die Nachricht an mich weiterleitet. Ohne E-Mail-Adresse bleibt sie anonym.',
    fbOwnMail: 'Lieber im eigenen Mailprogramm?',
    imprintTitle: 'Impressum',
    imprintLaw: 'Angaben gemäß § 5 DDG',
    imprintResp: 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
    imprintName: 'Christian Geller',
    disclaimerTitle: 'Haftung für Inhalte & Links',
    disclaimerText: 'Alle Programm-, Preis- und Filmangaben werden automatisch von den Seiten der Kinos sowie von TMDB, OMDb und Letterboxd übernommen und ohne Gewähr angezeigt. Verbindlich ist immer das Kino selbst. Für die Inhalte verlinkter Seiten sind ausschließlich deren Betreiber verantwortlich.',
    privacyTitle: 'Datenschutz',
    privacyText: 'Diese Seite setzt keine Cookies und bindet keine Analyse- oder Werbedienste ein. Favoriten, Sprache und die Angaben im Preisrechner bleiben ausschließlich in deinem Browser (localStorage) und werden nirgendwohin übertragen. Gehostet wird die Seite bei GitHub Pages (GitHub Inc.); beim Aufruf verarbeitet GitHub technisch notwendige Zugriffsdaten wie deine IP-Adresse. Wenn du das Feedback-Formular abschickst, wird deine Nachricht — und nur falls du sie angibst, deine E-Mail-Adresse — über den Dienst FormSubmit (formsubmit.co) an mein Postfach weitergeleitet. Ohne Adresse ist die Nachricht anonym; gespeichert wird sie sonst nirgends.',
    creditsTitle: 'Daten & Quellen',
    creditsText: 'Filmdaten und Poster von TMDB, Bewertungen von IMDb/Metascore (via OMDb) und Letterboxd. Spielzeiten von den Kinos und ihren Ticketshops. Dieses Projekt wird weder von TMDB noch von einem der Kinos betrieben oder unterstützt.',
    addCal: 'Zum Kalender hinzufügen',
    viewGrid: 'Filmansicht',
    viewPlan: 'Programm nach Uhrzeit',
    prices: 'Preise',
    pricesTitle: 'Preise & Familienangebote',
    pricesFor: (c) => `Preise: ${c}`,
    pricesBtnTitle: 'Ticketpreise & günstigste Vorstellung für Familien',
    priceFrom: (v) => `ab ${v}`,
    partyLabel: 'Wer geht ins Kino?',
    partyAdult: 'Erwachsene',
    partyChild: 'Kinder unter 12',
    partyReduced: 'Schüler:innen / Studierende',
    partyReducedHint: 'ermäßigt — Ausweis mitnehmen',
    threeDLabel: '3D-Zuschlag einrechnen',
    cheapestFirst: '💶 Günstigste zuerst',
    byTime: '🕒 Nach Zeit',
    cheapestBadge: 'Günstigste Option',
    perTicket: 'pro Ticket',
    forParty: (n) => `für ${n} ${n === 1 ? 'Person' : 'Personen'}`,
    familyHint: 'Family Ticket: alle zahlen den Kinderpreis',
    noPriceShows: 'Keine Vorstellungen mit Preisangaben in den aktuellen Filtern.',
    priceCinemaHint: 'Preise gibt es für alle 17 Kinos. Bei Kinopolis Bad Godesberg und dem Cinedom kommen sie pro Vorstellung direkt aus der Kinokasse, sonst aus der Preisliste des Kinos.',
    priceListLabel: 'Komplette Preisliste',
    surchargesLabel: 'Zuschläge',
    offersLabel: 'Angebote & Kombitickets',
    familyRuleLabel: 'Family Ticket',
    upTo: 'bis zu',
    atLeast: 'mindestens',
    priceStand: (d) => `Stand ${d} · Angaben ohne Gewähr`,
    priceSourceLink: 'Preisseite des Kinos ↗',
    priceOffersLink: 'Alle Angebote ↗',
    showMorePrices: (n) => `${n} weitere Vorstellungen zeigen`,
    priceTip: 'Tipp: Nachmittagsvorstellungen sind für Familien am günstigsten — in vielen Kinos zahlen dann auch die Erwachsenen den Kinderpreis.',
    priceKidsNote: 'Mit Kindern unter 12 zeigen wir nur Filme bis FSK 12 (ab FSK 12 nur mit Begleitung der Eltern).',
    priceCaveat: 'Wo wir den Kinopreis nicht direkt kennen, rechnen wir mit der Preisliste des Kinos — pro Film kann noch ein Zuschlag dazukommen.',
    exactPrices: 'Preise direkt vom Kino',
    estimated: 'geschätzt',
    estimateHint: 'Aus der Preisliste des Kinos berechnet — ein filmbezogener Zuschlag pro Ticket kann dazukommen.',
    menuChild: 'Kinder-Menü',
    menuHint: 'Kinder-Menü: Ticket + 0,3 l Softdrink + Kinder-Popcorn + Überraschungstüte',
    roles: { adult: 'Erwachsene', child: 'Kind unter 12', reduced: 'Ermäßigt', family: 'Family Ticket' },
    priceListNote: 'Das ist die allgemeine Preisliste des Kinos. Pro Film kommt teils ein Zuschlag dazu — in den Preisen oben ist er enthalten, sofern sie direkt vom Kino kommen.',
  },
  en: {
    locale: 'en-GB',
    search: 'Search movies…',
    kids: '🧒 Kids movies',
    kidsTitle: 'Movies for families with kids aged 6 to 12',
    clearSearch: 'Clear search',
    lastMinute: '⏰ Last minute',
    lastMinuteTitle: 'Movies starting now or within the next 4 hours',
    filter: 'Filters',
    sortLabel: 'Sort by:',
    sortNew: 'Recent',
    sortAlpha: 'A–Z',
    reviews: 'Ratings',
    resetAll: 'Reset',
    backHome: 'Back to home',
    backToList: '← Back to overview',
    backToTop: 'Back to top',
    activeFilters: 'Active filters',
    clearOne: (l) => `Remove filter “${l}”`,
    filterCount: (n) => `${n} active`,
    groupWhen: 'When',
    groupWhere: 'Where',
    groupWhat: 'What',
    groupRating: 'Rating',
    showtimesLabel: 'Showtimes',
    hiddenShows: (n) => `${n} more ${n === 1 ? 'screening is' : 'screenings are'} hidden — show all`,
    hiddenShowsOff: 'Show only matching screenings',
    noShowsHere: 'No screening matches these filters right now.',
    notFound: "We can't find this film in the current program.",
    bothCities: 'Both',
    cityAll: 'Both cities',
    quickFilters: 'Quick filters',
    moreFilters: 'More filters',
    nextWeek: 'Next week',
    favorites: 'Favorites',
    films: 'movies',
    stand: 'Updated',
    genres: 'Genres',
    version: 'Version',
    allVersions: 'All versions',
    germanVersion: 'German',
    cinemaLabel: 'Cinema',
    allCinemas: 'All cinemas',
    dateLabel: 'Date',
    allDays: 'All days',
    imdbMin: 'IMDb at least:',
    anyRating: 'any',
    timeLabel: 'Time:',
    reset: 'Reset filters',
    today: 'Today',
    tomorrow: 'Tomorrow',
    loading: 'Loading program…',
    loadError: (e) => `Could not load the program (${e}).`,
    empty: 'No movies match these filters. Reset the filters to see everything.',
    trailerDe: '▶ Trailer (German)',
    trailerOrig: '▶ Trailer (Original)',
    trailerOnly: '▶ Trailer',
    imdbLink: 'View on IMDb',
    metaLink: 'Search on Metacritic',
    lbLink: 'View on Letterboxd',
    favOn: 'Remove from favorites',
    favOff: 'Mark as favorite',
    langBadgeDe: 'German',
    topicsLabel: 'Topics',
    topics: {
      women_directed: '♀ Directed by women',
      queer: '🏳️‍🌈 Queer',
      international: '🌍 International',
    },
    origLangLabel: 'Original language',
    origLabel: 'Original',
    countryLabel: 'Country',
    director: 'Director',
    footer: 'Ratings: IMDb & Metascore via OMDb, metadata & FSK via TMDB. Topic and language filters are based on TMDB data (original language, director, keywords) — they surface films but aren\'t exhaustive. OV/OmU is read from the cinemas\' listings; some arthouse cinemas don\'t always tag original-version screenings.',
    thanksPre: 'Inspired by Steven Kocadag\'s wonderful',
    thanksPost: 'for Berlin — thank you! 🧡',
    tickets: 'Tickets',
    ticketsTitle: 'Buy tickets at the cinema',
    info: 'Info',
    infoTitle: "To the cinema's own page — it says there how to get in",
    contact: 'Contact & legal notice',
    contactBtn: 'Feedback & legal notice',
    contactIntro: 'Kino Köln · Bonn is a private, non-commercial hobby project: no ads, no trackers, no cookies.',
    feedbackTitle: 'Feedback',
    feedbackText: 'Is a cinema missing? Is a showtime or a version (OV/OmU) wrong? Is a price off, or is a feature missing? I\'d love to hear about it. Just write to me right here: anonymously or with your mail if you want me to respond.',
    feedbackHint: 'Helpful to include: cinema, film, date, and what the site says versus what it should say.',
    mailBtn: '✉ Write an email',
    fbLabel: 'Your message',
    fbPlaceholder: 'What is wrong, what is missing, what would you like to see?',
    fbNext: 'Continue',
    fbEmpty: 'Please write a message first.',
    fbAskTitle: 'Would you like a reply?',
    fbAskText: 'Then leave your email address — otherwise the message is sent anonymously. The address is only used to answer you.',
    fbEmailPh: 'you@example.com (optional)',
    fbEmailBad: 'That email address does not look right.',
    fbSendAnon: 'Send anonymously',
    fbSendReply: 'Send with my email',
    fbBack: '← Edit message',
    fbSending: 'Sending …',
    fbDone: 'Thank you! Your message got through. 🧡',
    fbDoneReply: 'I will get back to you as soon as I can.',
    fbAgain: 'Write another message',
    fbFail: 'Sorry, that did not work. Please try again later — or write directly to:',
    fbService: 'The form is handled by FormSubmit (formsubmit.co), which forwards the message to me. Without an email address it stays anonymous.',
    fbOwnMail: 'Prefer your own mail program?',
    imprintTitle: 'Legal notice (Impressum)',
    imprintLaw: 'Information pursuant to § 5 DDG',
    imprintResp: 'Responsible for the content under § 18 (2) MStV',
    imprintName: 'Christian Geller',
    disclaimerTitle: 'Liability for content & links',
    disclaimerText: 'All programme, price and film information is collected automatically from the cinemas\' own websites and from TMDB, OMDb and Letterboxd, and is shown without warranty. The cinema itself is always authoritative. The operators of linked sites are solely responsible for their content.',
    privacyTitle: 'Privacy',
    privacyText: 'This site sets no cookies and embeds no analytics or advertising services. Favourites, language and the price-calculator settings stay in your browser (localStorage) and are never transmitted anywhere. The site is hosted on GitHub Pages (GitHub Inc.); when you load it, GitHub processes technically necessary access data such as your IP address. When you submit the feedback form, your message — and your email address only if you choose to give one — is forwarded to my inbox by the service FormSubmit (formsubmit.co). Without an address the message is anonymous; it is not stored anywhere else.',
    creditsTitle: 'Data & sources',
    creditsText: 'Film data and posters from TMDB, ratings from IMDb/Metascore (via OMDb) and Letterboxd. Showtimes from the cinemas and their ticket shops. This project is neither run nor endorsed by TMDB or by any of the cinemas.',
    addCal: 'Add to calendar',
    viewGrid: 'Movie grid',
    viewPlan: 'Schedule by time',
    prices: 'Prices',
    pricesTitle: 'Prices & family offers',
    pricesFor: (c) => `Prices: ${c}`,
    pricesBtnTitle: 'Ticket prices & cheapest screening for families',
    priceFrom: (v) => `from ${v}`,
    partyLabel: 'Who is going?',
    partyAdult: 'Adults',
    partyChild: 'Children under 12',
    partyReduced: 'Pupils / students',
    partyReducedHint: 'reduced — bring your ID',
    threeDLabel: 'Include 3D surcharge',
    cheapestFirst: '💶 Cheapest first',
    byTime: '🕒 By time',
    cheapestBadge: 'Cheapest option',
    perTicket: 'per ticket',
    forParty: (n) => `for ${n} ${n === 1 ? 'person' : 'people'}`,
    familyHint: 'Family ticket: everyone pays the child price',
    noPriceShows: 'No screenings with price data match the current filters.',
    priceCinemaHint: 'Prices are available for all 17 cinemas. For Kinopolis Bad Godesberg and the Cinedom they come per screening straight from the box office; elsewhere from the cinema’s price list.',
    priceListLabel: 'Full price list',
    surchargesLabel: 'Surcharges',
    offersLabel: 'Offers & combi tickets',
    familyRuleLabel: 'Family ticket',
    upTo: 'up to',
    atLeast: 'at least',
    priceStand: (d) => `As of ${d} · no guarantee`,
    priceSourceLink: "Cinema's price page ↗",
    priceOffersLink: 'All offers ↗',
    showMorePrices: (n) => `Show ${n} more screenings`,
    priceTip: 'Tip: afternoon screenings are cheapest for families — at many cinemas the adults pay the child price then.',
    priceKidsNote: 'With children under 12 we only list films rated up to FSK 12 (FSK 12 only with a parent).',
    priceCaveat: "Where we don't have the cinema's own figure we use its price list — a per-film surcharge may still be added.",
    exactPrices: "Prices straight from the cinema",
    estimated: 'estimated',
    estimateHint: "Calculated from the cinema's price list — a film-related surcharge per ticket may be added.",
    menuChild: 'Kids menu',
    menuHint: 'Kids menu: ticket + 0.3 l soft drink + kids popcorn + surprise bag',
    roles: { adult: 'Adults', child: 'Under 12', reduced: 'Reduced', family: 'Family ticket' },
    priceListNote: "This is the cinema's general price list. Individual films can carry a surcharge — it is included in the prices above wherever they come straight from the cinema.",
  },
}

// Country ISO code → flag emoji (regional indicator symbols) + localized name
const countryFlag = (iso) =>
  iso && iso.length === 2
    ? String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)))
    : ''
const countryName = (iso, ui) => {
  try {
    return new Intl.DisplayNames([ui === 'en' ? 'en' : 'de'], { type: 'region' }).of(iso) || iso
  } catch {
    return iso
  }
}

const TOPIC_IDS = ['women_directed', 'queer', 'international']

// Original-language ISO 639-1 → display names + flag, for the language filter
// and the "Original: …" line in the popup. Only codes that appear in the data
// get a button; anything unmapped falls back to the raw code.
const LANGUAGES = {
  en: { flag: '🇬🇧', de: 'Englisch', en: 'English' },
  de: { flag: '🇩🇪', de: 'Deutsch', en: 'German' },
  fr: { flag: '🇫🇷', de: 'Französisch', en: 'French' },
  es: { flag: '🇪🇸', de: 'Spanisch', en: 'Spanish' },
  it: { flag: '🇮🇹', de: 'Italienisch', en: 'Italian' },
  ja: { flag: '🇯🇵', de: 'Japanisch', en: 'Japanese' },
  ko: { flag: '🇰🇷', de: 'Koreanisch', en: 'Korean' },
  zh: { flag: '🇨🇳', de: 'Chinesisch', en: 'Chinese' },
  hi: { flag: '🇮🇳', de: 'Hindi', en: 'Hindi' },
  sv: { flag: '🇸🇪', de: 'Schwedisch', en: 'Swedish' },
  no: { flag: '🇳🇴', de: 'Norwegisch', en: 'Norwegian' },
  nl: { flag: '🇳🇱', de: 'Niederländisch', en: 'Dutch' },
  pt: { flag: '🇵🇹', de: 'Portugiesisch', en: 'Portuguese' },
  el: { flag: '🇬🇷', de: 'Griechisch', en: 'Greek' },
  uk: { flag: '🇺🇦', de: 'Ukrainisch', en: 'Ukrainian' },
  ar: { flag: '🇸🇦', de: 'Arabisch', en: 'Arabic' },
  tr: { flag: '🇹🇷', de: 'Türkisch', en: 'Turkish' },
  is: { flag: '🇮🇸', de: 'Isländisch', en: 'Icelandic' },
  ka: { flag: '🇬🇪', de: 'Georgisch', en: 'Georgian' },
  tl: { flag: '🇵🇭', de: 'Philippinisch', en: 'Filipino' },
  ta: { flag: '🇮🇳', de: 'Tamil', en: 'Tamil' },
  ml: { flag: '🇮🇳', de: 'Malayalam', en: 'Malayalam' },
  te: { flag: '🇮🇳', de: 'Telugu', en: 'Telugu' },
  pa: { flag: '🇮🇳', de: 'Punjabi', en: 'Punjabi' },
  fa: { flag: '🇮🇷', de: 'Persisch', en: 'Persian' },
  ca: { flag: '🇪🇸', de: 'Katalanisch', en: 'Catalan' },
  da: { flag: '🇩🇰', de: 'Dänisch', en: 'Danish' },
  pl: { flag: '🇵🇱', de: 'Polnisch', en: 'Polish' },
  ru: { flag: '🇷🇺', de: 'Russisch', en: 'Russian' },
  cs: { flag: '🇨🇿', de: 'Tschechisch', en: 'Czech' },
  fi: { flag: '🇫🇮', de: 'Finnisch', en: 'Finnish' },
  he: { flag: '🇮🇱', de: 'Hebräisch', en: 'Hebrew' },
  th: { flag: '🇹🇭', de: 'Thailändisch', en: 'Thai' },
}
// Languages we don't have a flag for still get a proper name: the browser's own
// language table covers every ISO code, so a film in Malayalam or Georgian can
// never again show up as a bare "ML" the way it used to.
const langName = (code, ui) => {
  if (LANGUAGES[code]) return LANGUAGES[code][ui]
  try {
    const n = new Intl.DisplayNames([ui === 'en' ? 'en' : 'de'], { type: 'language' }).of(code)
    if (n && n.toLowerCase() !== String(code).toLowerCase()) return n[0].toUpperCase() + n.slice(1)
  } catch { /* invalid code — fall through */ }
  return (code || '').toUpperCase()
}
const langFlag = (code) => (LANGUAGES[code] ? LANGUAGES[code].flag + ' ' : '')

// Always offered in the language filter, even on days when nothing is playing
// in them — the visitor asked to be able to look for Korean films at any time.
const PINNED_LANGS = ['ko']

// TMDB delivers genre names in German; translate for the English UI.
const GENRES_EN = {
  'Abenteuer': 'Adventure', 'Dokumentarfilm': 'Documentary', 'Familie': 'Family',
  'Historie': 'History', 'Komödie': 'Comedy', 'Kriegsfilm': 'War', 'Krimi': 'Crime',
  'Liebesfilm': 'Romance', 'Musik': 'Music', 'TV-Film': 'TV Movie',
}
const genreName = (g, ui) => (ui === 'en' ? (GENRES_EN[g] || g) : g)

// --- filter option definitions -------------------------------------------
const CITIES = ['Alle', 'Bonn', 'Köln']
const LANGS = [
  { id: 'alle', labelKey: 'allVersions' },
  { id: 'ovomu', label: 'OV / OmU' },
  { id: 'de', labelKey: 'germanVersion' },
]
// every sort lives in one compact dropdown to keep the landing toolbar calm
const SORT_OPTIONS = [
  { id: 'imdb', icon: '⭐', label: 'IMDb' },
  { id: 'metascore', icon: '🎯', label: 'Metascore' },
  { id: 'letterboxd', icon: '🎬', label: 'Letterboxd' },
  { id: 'recent', icon: '🆕', labelKey: 'sortNew' },
  { id: 'alpha', icon: '🔤', labelKey: 'sortAlpha' },
]
// German TMDB genre names that actually signal a film made for kids/families.
// (Deliberately NOT "Abenteuer" — Adventure also tags FSK-12 blockbusters like
// Dune or Inception, which aren't kids films.)
const KID_GENRES = ['Familie', 'Animation']

// A film counts as one for families with children ~6–12 if it carries a
// family/animation genre and is rated at most FSK 12 (or not yet rated).
// Tunable here without re-scraping.
function isKidsFilm(m) {
  const age = m.age_rating
  if (age != null && age > 12) return false
  return (m.genres || []).some((g) => KID_GENRES.includes(g))
}

function matchesLang(show, lang) {
  if (lang === 'alle') return true
  if (lang === 'de') return show.language === 'DE'
  return show.language === 'OV' || show.language === 'OmU'
}

// Topic pills: women_directed/queer come from TMDB tags; "international" is
// derived from the film's original language (anything but German or English).
function matchTopic(m, tag) {
  if (tag === 'international') {
    const l = m.original_language
    return !!l && l !== 'de' && l !== 'en'
  }
  return (m.tags || []).includes(tag)
}

function dayKey(iso) {
  return iso.slice(0, 10)
}

function fmtTime(iso, t) {
  return new Date(iso).toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' })
}

function fmtDay(iso, t) {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return t.today
  if (d.toDateString() === tomorrow.toDateString()) return t.tomorrow
  return d.toLocaleDateString(t.locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtDayShort(key, t) {
  const d = new Date(key + 'T12:00:00')
  const today = new Date()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return t.today
  if (d.toDateString() === tomorrow.toDateString()) return t.tomorrow
  return d.toLocaleDateString(t.locale, { weekday: 'short', day: '2-digit', month: '2-digit' })
}

// full-date heading for the schedule view, e.g. "Heute · Mittwoch, 8. Juli"
function fmtDayFull(key, t) {
  const d = new Date(key + 'T12:00:00')
  const long = d.toLocaleDateString(t.locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const today = new Date()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return `${t.today} · ${long}`
  if (d.toDateString() === tomorrow.toDateString()) return `${t.tomorrow} · ${long}`
  return long
}

// downloadable .ics calendar event for one screening
function icsHref(movie, s, ui) {
  const start = new Date(s.datetime)
  const end = new Date(start.getTime() + ((movie.runtime || 120) + 20) * 60000) // + ads/trailers
  const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const esc = (v) => String(v).replace(/[\\;,]/g, (c) => '\\' + c)
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//kinoguide-koeln//DE', 'BEGIN:VEVENT',
    `UID:${stamp(start)}-${esc(s.cinema).replace(/\W/g, '')}@kinoguide-koeln`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:🎬 ${esc(displayTitle(movie, ui))} (${s.language})`,
    `LOCATION:${esc(s.cinema)}\\, ${esc(s.city)}`,
    s.booking_url ? `URL:${s.booking_url}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean)
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'))
}

// Display title / overview depending on UI language
const displayTitle = (m, ui) => (ui === 'en' ? (m.title_original || m.title_de) : m.title_de)
const displaySubtitle = (m, ui) => {
  const other = ui === 'en' ? m.title_de : m.title_original
  return other !== displayTitle(m, ui) ? other : null
}
const displayOverview = (m, ui) =>
  ui === 'en' ? (m.overview_en || m.overview_de) : (m.overview_de || m.overview_en)

// --- small components ------------------------------------------------------
function LangBadge({ lang, t }) {
  const label = lang === 'DE' ? t.langBadgeDe : lang
  return <span className={`badge-lang lang-${lang.toLowerCase()}`}>{label}</span>
}

// Corner badge mirrors the metric the list is sorted by
const BADGE_METRICS = {
  imdb:       { emoji: '⭐', fmt: (v) => v.toFixed(1) },
  metascore:  { emoji: '🎯', fmt: (v) => String(v) },
  letterboxd: { emoji: '🎬', fmt: (v) => v.toFixed(1) },
}

// memo: with ~250 cards on screen, re-rendering all of them on every keystroke
// or filter click is the single biggest source of jank. All props are stable
// (t/ui/sort are primitives or module constants, the callbacks are hoisted).
const Card = memo(function Card({ movie, onOpen, isFav, onToggleFav, t, ui, sort }) {
  const langs = [...new Set(movie.showtimes.map((s) => s.language))]
  const metricKey = BADGE_METRICS[sort] ? sort : 'imdb'
  const metric = BADGE_METRICS[metricKey]
  const value = movie.ratings[metricKey]
  return (
    <div
      className="card" role="button" tabIndex={0}
      onClick={() => onOpen(movie)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(movie) } }}
    >
      <div className="card-poster">
        {movie.poster
          ? <img
              src={movie.poster}
              srcSet={`${movie.poster.replace('/w342/', '/w185/')} 185w, ${movie.poster} 342w`}
              sizes="(max-width: 640px) 45vw, 200px"
              width="342" height="513"
              alt="" loading="lazy" decoding="async" />
          : <div className="poster-fallback">{(movie.title_original || movie.title_de).slice(0, 2)}</div>}
        {value != null && (
          <span className="badge-rating"><span className="star">{metric.emoji}</span>{metric.fmt(value)}</span>
        )}
        <div className="badge-langs">
          {langs.includes('OV') && <LangBadge lang="OV" t={t} />}
          {langs.includes('OmU') && <LangBadge lang="OmU" t={t} />}
          {langs.includes('DE') && <LangBadge lang="DE" t={t} />}
        </div>
        {movie.age_rating != null && <span className="badge-fsk">FSK {movie.age_rating}</span>}
        <button
          className={`fav-btn ${isFav ? 'on' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleFav(movie.id) }}
          title={isFav ? t.favOn : t.favOff}
          aria-label="Favorit"
        >
          {isFav ? '♥' : '♡'}
        </button>
      </div>
      <div className="card-body">
        <h3 title={displayTitle(movie, ui)}>{displayTitle(movie, ui)}</h3>
        <p className="card-meta">
          {movie.year}
          {(movie.genres || []).slice(0, 2).map((g) => <span className="genre-pill" key={g}>{genreName(g, ui)}</span>)}
        </p>
      </div>
    </div>
  )
})

// One rating in the modal — a clickable chip (with emoji + arrow) when we can
// link to the review site, a plain unboxed value otherwise.
function Rating({ value, label, emoji, href, title }) {
  const inner = <>{emoji} <b>{value ?? '–'}</b> {label}</>
  if (!href) return <span className="rating-plain">{inner}</span>
  return (
    <a className="rating-link" href={href} target="_blank" rel="noreferrer" title={title}>
      {inner}<span className="ext">↗</span>
    </a>
  )
}

// Per-cinema facts that come with the program rather than from prices.js —
// city, website, and whether the cinema sells tickets online at all. Filled once
// from movies.json as it arrives, before anything renders, so the screening
// boxes can read it without every component passing the map down.
let CINEMA_META = {}

// A venue marked ticketing: "info" has no ticket shop we can link into: the
// Kinemathek's two open-airs sell through their own event page, and the
// Stummfilmtage sell nothing at all because entry is free. Their screenings get
// an "Infos" link of exactly the same size as the Tickets button — the same
// affordance, without claiming you can buy there.
// A screening can also be flagged one by one: the Bonner Kinemathek sells on
// its own site, and we only find part of its programme there, so some of its
// screenings link to a checkout and the rest only to the film or the programme.
const isInfoOnly = (show) =>
  show.info === true || CINEMA_META[show.cinema]?.ticketing === 'info'
const ticketNote = (cinema, ui) => CINEMA_META[cinema]?.ticket_note?.[ui]

// The screening list of one film, grouped by cinema and then by day.
function Showtimes({ movie, shows, onPrices, party, threeD, live, t, ui }) {
  const byCinema = {}
  for (const s of shows) {
    const key = `${s.cinema} · ${s.city}`
    ;(byCinema[key] = byCinema[key] || []).push(s)
  }
  return (
    <div className="film-shows">
      {Object.entries(byCinema).map(([cinema, times]) => {
        // one compact row per day instead of one chip per screening
        const byDay = {}
        for (const s of times) {
          const d = dayKey(s.datetime)
          ;(byDay[d] = byDay[d] || []).push(s)
        }
        // cinemas we know prices for get an "ab X €" button: the cheapest
        // total for the visitor's party across this film's screenings there
        const cfg = CINEMA_PRICES[times[0].cinema]
        const cheap = cfg && cheapestTotal(cfg, movie, times, party, { threeD }, live)
        const note = ticketNote(times[0].cinema, ui)
        return (
          <div className="cinema-row" key={cinema}>
            <div className="cinema-head">
              <span className="cinema-name">{cinema}</span>
              {cfg && (
                <button className="cinema-price" onClick={onPrices} title={t.pricesBtnTitle}>
                  💶 {cheap != null ? t.priceFrom(fmtEur(cheap, t.locale)) : t.prices}
                </button>
              )}
            </div>
            {/* how you actually get in, where that isn't "click Tickets" */}
            {note && <p className="cinema-note">{note}</p>}
            {Object.keys(byDay).sort().map((d) => (
              <div className="day-times" key={d}>
                <span className="day-label">{fmtDayShort(d, t)}</span>
                <span className="times">
                  {byDay[d].map((tm, i) => (
                    // one self-contained box per screening: time + version on
                    // top, the two things you can *do* with it underneath. The
                    // booking link can't wrap the whole box because the calendar
                    // download is a link too, and links don't nest.
                    <div className={`showbox lang-${tm.language.toLowerCase()}`} key={i}>
                      <div className="showbox-head">
                        <span className="show-time">{fmtTime(tm.datetime, t)}</span>
                        <span className="lang-tag">{tm.language}</span>
                      </div>
                      <div className="showbox-acts">
                        {tm.booking_url && (
                          isInfoOnly(tm) ? (
                            <a className="show-tix show-info" href={tm.booking_url}
                              target="_blank" rel="noreferrer" title={t.infoTitle}>ℹ️ {t.info}</a>
                          ) : (
                            <a className="show-tix" href={tm.booking_url} target="_blank" rel="noreferrer"
                              title={t.ticketsTitle}>🎟️ {t.tickets}</a>
                          )
                        )}
                        <a className="cal-btn" href={icsHref(movie, tm, ui)}
                          download={`${displayTitle(movie, ui).replace(/[^\w äöüÄÖÜß-]/g, '')}.ics`}
                          title={t.addCal} aria-label={t.addCal}>📅</a>
                      </div>
                    </div>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// A film gets its own page (own URL, own browser-history entry) rather than a
// popup: it can be linked to and shared, and the back button returns to the
// list at the exact scroll position it was left at.
function FilmPage({ movie, shows, allShows, onBack, onPrices, party, threeD, live,
                    isFav, onToggleFav, t, ui }) {
  // showing every screening we have is a click away when the filters hide some
  const [showAll, setShowAll] = useState(false)
  const hidden = allShows.length - shows.length
  const listed = showAll ? allShows : shows

  useEffect(() => { setShowAll(false) }, [movie.id])

  useEffect(() => {
    const onKey = (e) => {
      // the price panel opens on top of this page — let it swallow the Escape
      if (e.key === 'Escape' && !document.querySelector('.price-modal')) onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  // movie.id is the IMDb id when TMDB could resolve one (tt…), else a title key
  const imdbId = typeof movie.id === 'string' && movie.id.startsWith('tt') ? movie.id : null
  const metaSearch = `https://www.metacritic.com/search/${encodeURIComponent(movie.title_original || movie.title_de)}/`
  const overview = displayOverview(movie, ui)
  const facts = [
    movie.year, movie.runtime && `${movie.runtime} min`,
    movie.age_rating != null && `FSK ${movie.age_rating}`,
  ].filter(Boolean).join(' · ')

  return (
    <article className="film">
      <div className="film-bar">
        <button className="film-back" onClick={onBack}>{t.backToList}</button>
        <button className={`film-fav ${isFav ? 'on' : ''}`} onClick={() => onToggleFav(movie.id)}
          title={isFav ? t.favOn : t.favOff}>
          {isFav ? '♥' : '♡'} {t.favorites}
        </button>
      </div>

      <header className="film-hero">
        {/* the poster itself, blurred, doubles as the backdrop — we don't
            scrape backdrop images, and this keeps the page to one download */}
        {movie.poster && (
          <div className="film-hero-bg" style={{ backgroundImage: `url(${movie.poster})` }} aria-hidden="true" />
        )}
        <div className="film-hero-in">
          {movie.poster
            ? <img className="film-poster" src={movie.poster} alt="" width="342" height="513" fetchpriority="high" />
            : <div className="film-poster poster-fallback">{(movie.title_original || movie.title_de).slice(0, 2)}</div>}
          <div className="film-head">
            <h1>{displayTitle(movie, ui)}</h1>
            {displaySubtitle(movie, ui) && <p className="film-orig">{displaySubtitle(movie, ui)}</p>}
            {facts && <p className="film-facts">{facts}</p>}
            <dl className="film-meta">
              {(movie.directors || []).length > 0 && (
                <><dt>{t.director}</dt><dd>{movie.directors.join(', ')}</dd></>
              )}
              {movie.original_language && movie.original_language !== 'de' && (
                <><dt>{t.origLabel}</dt>
                  <dd>{langFlag(movie.original_language)}{langName(movie.original_language, ui)}</dd></>
              )}
              {(movie.countries || []).length > 0 && (
                <><dt>{t.countryLabel}</dt>
                  <dd>{movie.countries.map((c) => `${countryFlag(c)} ${countryName(c, ui)}`).join(', ')}</dd></>
              )}
            </dl>
            <p className="film-genres">
              {(movie.genres || []).map((g) => <span className="genre-pill" key={g}>{genreName(g, ui)}</span>)}
              {(movie.tags || []).map((tg) => <span className="topic-pill" key={tg}>{t.topics[tg]}</span>)}
            </p>
            <div className="film-ratings">
              <Rating value={movie.ratings.imdb} label="IMDb" emoji="⭐"
                href={imdbId && `https://www.imdb.com/title/${imdbId}/`}
                title={t.imdbLink} />
              <Rating value={movie.ratings.metascore} label="Meta" emoji="🎯"
                href={movie.ratings.metascore != null ? metaSearch : null}
                title={t.metaLink} />
              <Rating value={movie.ratings.letterboxd} label="Letterboxd" emoji="🎬"
                href={imdbId && `https://letterboxd.com/imdb/${imdbId}/`}
                title={t.lbLink} />
            </div>
            {(movie.trailer_de || movie.trailer_en) && (
              <div className="trailer-row">
                {movie.trailer_de && (
                  <a className="trailer-btn" href={movie.trailer_de} target="_blank" rel="noreferrer">
                    {movie.trailer_en ? t.trailerDe : t.trailerOnly}
                  </a>
                )}
                {movie.trailer_en && (
                  <a className="trailer-btn" href={movie.trailer_en} target="_blank" rel="noreferrer">
                    {movie.trailer_de ? t.trailerOrig : t.trailerOnly}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {overview && <p className="film-desc">{overview}</p>}

      <h2 className="film-h2">{t.showtimesLabel}</h2>
      {listed.length === 0
        ? <p className="empty">{t.noShowsHere}</p>
        : <Showtimes movie={movie} shows={listed} onPrices={onPrices}
            party={party} threeD={threeD} live={live} t={t} ui={ui} />}
      {hidden > 0 && (
        <button className="film-allshows" onClick={() => setShowAll((v) => !v)}>
          {showAll ? t.hiddenShowsOff : t.hiddenShows(hidden)}
        </button>
      )}
    </article>
  )
}

// The one contact address of the site. It is deliberately assembled at runtime
// rather than written into the HTML as one string: an Impressum mail address is
// the single most reliably harvested thing on a German website.
const CONTACT_USER = 'kinokoelnbonn'
const CONTACT_HOST = 'gmail.com'
const CONTACT_MAIL = `${CONTACT_USER}@${CONTACT_HOST}`

// The feedback form. The site is static (GitHub Pages), so there is no server
// of ours to post to: FormSubmit (formsubmit.co) takes the POST and forwards it
// to CONTACT_MAIL. Chosen by the user 2026-08-01 over Web3Forms/Formspree
// because it needs no account — the address is public in the Impressum anyway.
// The endpoint is assembled at runtime from the two address halves for the same
// anti-harvesting reason as CONTACT_MAIL itself.
//
// Two-step on purpose: write the message first, and only *at* the send do we
// ask whether the visitor wants an answer. Leaving the field empty sends
// anonymously — that is the default, not an opt-out.
function FeedbackForm({ t, mailto }) {
  const [step, setStep] = useState('write')   // write · ask · sending · done · fail
  const [msg, setMsg] = useState('')
  const [email, setEmail] = useState('')
  // the error is kept as a key, not as text: switching DE/EN with an error on
  // screen must translate it, and a stored string would stay in the old language
  const [err, setErr] = useState('')          // '' · 'fbEmpty' · 'fbEmailBad'
  const [honey, setHoney] = useState('')      // bots fill it, humans never see it
  const [replied, setReplied] = useState(false)

  const toAsk = () => {
    if (!msg.trim()) { setErr('fbEmpty'); return }
    setErr(''); setStep('ask')
  }

  const send = async () => {
    const addr = email.trim()
    if (addr && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(addr)) { setErr('fbEmailBad'); return }
    if (honey) { setStep('done'); return }     // silently swallow the bot
    setErr(''); setStep('sending')
    try {
      const r = await fetch(`https://formsubmit.co/ajax/${CONTACT_MAIL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          message: msg.trim(),
          // FormSubmit uses a field called "email" as the Reply-To
          email: addr || undefined,
          _subject: `Kino Köln Bonn — Feedback${addr ? '' : ' (anonym)'}`,
          _template: 'table',
          _captcha: 'false',
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || String(j.success) === 'false') throw new Error(j.message || r.status)
      setReplied(!!addr); setMsg(''); setEmail(''); setStep('done')
    } catch (e) {
      console.error('feedback send failed', e)
      setStep('fail')
    }
  }

  if (step === 'done') return (
    <div className="fb-done">
      <p className="fb-thanks">{t.fbDone}</p>
      {replied && <p className="info-hint">{t.fbDoneReply}</p>}
      <button className="fb-link" onClick={() => { setReplied(false); setStep('write') }}>{t.fbAgain}</button>
    </div>
  )

  if (step === 'fail') return (
    <div className="fb-done">
      <p>{t.fbFail} <a href={mailto}>{CONTACT_MAIL}</a></p>
      <button className="fb-link" onClick={() => setStep('write')}>{t.fbBack}</button>
    </div>
  )

  return (
    <div className="fb-form">
      {step === 'write' ? (
        <>
          <label className="fb-label" htmlFor="fb-msg">{t.fbLabel}</label>
          <textarea id="fb-msg" className="fb-text" rows={6} value={msg}
            placeholder={t.fbPlaceholder}
            onChange={(e) => { setMsg(e.target.value); if (err) setErr('') }} />
          <div className="fb-row">
            <button className="fb-send" onClick={toAsk}>{t.fbNext}</button>
          </div>
        </>
      ) : (
        <>
          <p className="fb-ask">{t.fbAskTitle}</p>
          <p className="info-hint">{t.fbAskText}</p>
          <input className="fb-email" type="email" inputMode="email" autoComplete="email"
            value={email} placeholder={t.fbEmailPh} aria-label={t.fbEmailPh}
            disabled={step === 'sending'}
            onChange={(e) => { setEmail(e.target.value); if (err) setErr('') }} />
          <div className="fb-row">
            <button className="fb-send" onClick={send} disabled={step === 'sending'}>
              {step === 'sending' ? t.fbSending : (email.trim() ? t.fbSendReply : t.fbSendAnon)}
            </button>
            <button className="fb-link" onClick={() => { setErr(''); setStep('write') }}
              disabled={step === 'sending'}>{t.fbBack}</button>
          </div>
        </>
      )}
      {/* honeypot: off-screen, not hidden — some bots skip display:none fields */}
      <input className="fb-honey" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={honey} onChange={(e) => setHoney(e.target.value)} />
      {err && <p className="fb-err" role="alert">{t[err]}</p>}
      <p className="info-hint fb-note">{t.fbService}</p>
    </div>
  )
}

// Feedback + Impressum, on its own URL (?seite=kontakt) with its own history
// entry, exactly like a film page — so the ✉ button in the header and the
// browser's Back button behave the same way everywhere.
function ContactPage({ onBack, t }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onBack() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  const mailto = `mailto:${CONTACT_MAIL}?subject=${encodeURIComponent('Kino Köln · Bonn')}`

  return (
    <article className="info-page">
      <div className="film-bar">
        <button className="film-back" onClick={onBack}>{t.backToList}</button>
      </div>

      <h1>{t.contact}</h1>
      <p className="info-lead">{t.contactIntro}</p>

      <section>
        <h2>{t.feedbackTitle}</h2>
        <p>{t.feedbackText}</p>
        <p className="info-hint">{t.feedbackHint}</p>
        <FeedbackForm t={t} mailto={mailto} />
        <p className="info-hint fb-own">{t.fbOwnMail}</p>
        <a className="info-mail" href={mailto}>{t.mailBtn}</a>
        <p className="info-addr">{CONTACT_MAIL}</p>
      </section>

      <section>
        <h2>{t.imprintTitle}</h2>
        <p className="info-hint">{t.imprintLaw}</p>
        <address>
          {t.imprintName}<br />
          <a href={mailto}>{CONTACT_MAIL}</a>
        </address>
        <p className="info-hint">{t.imprintResp}: {t.imprintName}</p>
      </section>

      <section>
        <h2>{t.disclaimerTitle}</h2>
        <p>{t.disclaimerText}</p>
      </section>

      <section>
        <h2>{t.privacyTitle}</h2>
        <p>{t.privacyText}</p>
      </section>

      <section>
        <h2>{t.creditsTitle}</h2>
        <p>{t.creditsText}</p>
      </section>
    </article>
  )
}

// --- prices ----------------------------------------------------------------
// Ticket name without its time window: "Kinder unter 12 & Family Ticket
// (vor 18 Uhr)" → "Kinder unter 12". The family case gets its own label so a
// parent sees *why* the adult ticket suddenly costs the child price. Exact
// prices carry a plain role instead of one of our ticket definitions.
function lineLabel(l, ui, t) {
  if (l.role) return t.roles[l.role]
  if (l.viaFamily) return ui === 'en' ? 'Family ticket' : 'Family Ticket'
  return (ui === 'en' ? l.ticket.en : l.ticket.de).replace(/\s*\(.*\)\s*$/, '').replace(/\s*&.*$/, '')
}

// adults and students both land on the Family Ticket — show that as one line
function mergeLines(lines, ui, t) {
  const out = []
  for (const l of lines) {
    const label = lineLabel(l, ui, t)
    const same = out.find((o) => o.label === label && o.each === l.each)
    if (same) same.count += l.count
    else out.push({ label, each: l.each, count: l.count })
  }
  return out
}

// −/+ counter for one visitor category
function PartyStep({ label, hint, value, onChange }) {
  return (
    <div className="party-item">
      <span className="party-label">{label}{hint && <em>{hint}</em>}</span>
      <span className="party-step">
        <button onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0} aria-label="−">−</button>
        <b>{value}</b>
        <button onClick={() => onChange(Math.min(12, value + 1))} aria-label="+">+</button>
      </span>
    </div>
  )
}

// One surcharge, which may be a range ("1,00 – 5,00 €") or an upper bound
function surchargeText(s, t, ui) {
  const label = ui === 'en' ? s.en : s.de
  if (s.pct) return `${label}: ${s.pct} %`
  const amount = s.to
    ? `${fmtEur(s.amount, t.locale)} – ${fmtEur(s.to, t.locale)}`
    : `${s.upTo ? `${t.upTo} ` : ''}${s.atLeast ? `${t.atLeast} ` : ''}${fmtEur(s.amount, t.locale)}`
  return `${label}: ${amount}`
}

// The full price list of one cinema, plus its surcharges, family rule and offers.
// Every cinema brings its own day tiers, so the table's columns come from the
// entry rather than from one shared set of labels.
function PriceReference({ cinema, cfg, t, ui }) {
  const tiers = tierLabels(cfg, ui)
  const displayOnly = cfg.displayOnly || []
  const surcharges = cfg.surcharges || []
  const offers = cfg.offers || []
  return (
    <div className="price-ref">
      <h3>{cinema}</h3>
      <div className="price-table-wrap">
        <table className="price-table">
          <thead>
            <tr><th></th>{tiers.map((l) => <th key={l}>{l}</th>)}</tr>
          </thead>
          <tbody>
            {cfg.tickets.map((tk) => (
              <tr key={tk.id}>
                <td>{ui === 'en' ? tk.en : tk.de}</td>
                {tk.price.map((p, i) => <td key={i}>{p == null ? '–' : fmtEur(p, t.locale)}</td>)}
              </tr>
            ))}
            {displayOnly.map((d) => (
              <tr key={d.de}>
                <td>{ui === 'en' ? d.en : d.de}</td>
                <td colSpan={tiers.length} className="flat">
                  {d.flat == null ? '–' : fmtEur(d.flat, t.locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="price-note">{t.priceListNote}</p>
      {cfg.note && <p className="price-note">{ui === 'en' ? cfg.note.en : cfg.note.de}</p>}
      {cfg.familyTicket && (
        <p className="price-note"><b>{t.familyRuleLabel}:</b>{' '}
          {ui === 'en' ? cfg.familyTicket.en : cfg.familyTicket.de}</p>
      )}
      {surcharges.length > 0 && (
        <p className="price-note"><b>{t.surchargesLabel}:</b>{' '}
          {surcharges.map((s, i) => (
            <span key={i}>{i > 0 && ' · '}{surchargeText(s, t, ui)}</span>
          ))}
        </p>
      )}
      {offers.length > 0 && <>
        <p className="price-note"><b>{t.offersLabel}:</b></p>
        <ul className="price-offers">
          {offers.map((o, i) => (
            <li key={i}>{o.url
              ? <a href={o.url} target="_blank" rel="noreferrer">{ui === 'en' ? o.en : o.de} ↗</a>
              : (ui === 'en' ? o.en : o.de)}</li>
          ))}
        </ul>
      </>}
      <p className="price-src">
        {t.priceStand(new Date(cfg.checked).toLocaleDateString(t.locale))} ·{' '}
        <a href={cfg.source} target="_blank" rel="noreferrer">{t.priceSourceLink}</a>
        {cfg.offersUrl && <> · <a href={cfg.offersUrl} target="_blank" rel="noreferrer">{t.priceOffersLink}</a></>}
      </p>
    </div>
  )
}

// Price finder: pick who's coming, get every screening we know prices for,
// cheapest first. `movie` set = scoped to that film, otherwise all filtered
// screenings of cinemas with price data.
function PriceModal({ items, movie, party, setParty, threeD, setThreeD, live, onClose, onOpenMovie, t, ui }) {
  const [byPrice, setByPrice] = useState(true)
  const [limit, setLimit] = useState(15)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const priced = useMemo(() => {
    const rows = []
    for (const { m, s } of items) {
      const cfg = CINEMA_PRICES[s.cinema]
      if (!cfg) continue
      // with a child in the party, films they can't get into are pointless:
      // under 12s are only admitted up to FSK 12, and then with a parent
      if (party.child > 0 && m.age_rating != null && m.age_rating > 12) continue
      const p = priceFor(cfg, m, s, party, { threeD }, live)
      if (p) rows.push({ m, s, p })
    }
    rows.sort((a, b) =>
      byPrice
        ? a.p.total - b.p.total || a.s.datetime.localeCompare(b.s.datetime)
        : a.s.datetime.localeCompare(b.s.datetime))
    // across all films, one row per film (its cheapest / next screening) —
    // otherwise a single film's matinees fill the whole list at the same price.
    // Scoped to one film we want every screening.
    if (movie) return rows
    const seen = new Set()
    return rows.filter(({ m }) => !seen.has(m.id) && seen.add(m.id))
  }, [items, movie, party, threeD, live, byPrice])

  const cinemas = [...new Set(items.map(({ s }) => s.cinema))].filter((c) => CINEMA_PRICES[c])
  const n = partySize(party)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal price-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Schließen">✕</button>
        <h2 className="price-head">💶 {movie ? displayTitle(movie, ui) : t.pricesTitle}</h2>
        <p className="price-tip">
          {t.priceTip}
          {party.child > 0 && <><br />{t.priceKidsNote}</>}
          <br /><span className="price-caveat">{t.priceCaveat}</span>
        </p>

        <div className="party">
          <span className="party-title">{t.partyLabel}</span>
          <div className="party-grid">
            <PartyStep label={t.partyAdult} value={party.adult || 0}
              onChange={(v) => setParty({ ...party, adult: v })} />
            <PartyStep label={t.partyChild} value={party.child || 0}
              onChange={(v) => setParty({ ...party, child: v })} />
            <PartyStep label={t.partyReduced} hint={t.partyReducedHint} value={party.reduced || 0}
              onChange={(v) => setParty({ ...party, reduced: v })} />
          </div>
          <div className="party-opts">
            {/* the cinema's own prices already include the format, so the 3D
                switch is only meaningful for estimated rows */}
            {priced.some((r) => !r.p.exact) && (
              <label>
                <input type="checkbox" checked={threeD} onChange={(e) => setThreeD(e.target.checked)} />
                {t.threeDLabel}
              </label>
            )}
            {priced.some((r) => r.p.exact) && <span className="party-live">✓ {t.exactPrices}</span>}
          </div>
        </div>

        {n > 0 && priced.length > 0 && (
          <>
            <div className="price-sort">
              <button className={byPrice ? 'on' : ''} onClick={() => setByPrice(true)}>{t.cheapestFirst}</button>
              <button className={!byPrice ? 'on' : ''} onClick={() => setByPrice(false)}>{t.byTime}</button>
            </div>
            <ul className="price-list">
              {priced.slice(0, limit).map(({ m, s, p }, i) => (
                <li className={`price-row ${byPrice && i === 0 ? 'best' : ''}`} key={`${m.id}-${s.datetime}-${i}`}>
                  <div className="pr-main">
                    <span className="pr-when">{fmtDayShort(dayKey(s.datetime), t)} · {fmtTime(s.datetime, t)}</span>
                    {!movie && (
                      <button className="pr-title" onClick={() => onOpenMovie(m)}>{displayTitle(m, ui)}</button>
                    )}
                    <span className={`lang-tag lang-${s.language.toLowerCase()}`}>{s.language}</span>
                    {p.format && <span className="pr-format">{p.format}</span>}
                    <span className="pr-total">{fmtEur(p.total, t.locale)}</span>
                    {s.booking_url && (
                      <a className="pr-ticket" href={s.booking_url} target="_blank" rel="noreferrer"
                        title={t.ticketsTitle}>🎟️ {t.tickets}</a>
                    )}
                  </div>
                  <div className="pr-detail">
                    {/* only worth naming when more than one cinema is in the list */}
                    {cinemas.length > 1 && <span className="pr-cinema">{s.cinema}</span>}
                    {mergeLines(p.lines, ui, t).map((l, j) => (
                      <span className="pr-line" key={j}>
                        {l.count}× {l.label} <b>{fmtEur(l.each, t.locale)}</b>
                      </span>
                    ))}
                    {/* only badge it when the family fare actually changed a
                        line — at the Woki the whole Tuesday is cheap for
                        everyone, which is not a family ticket */}
                    {p.family && p.lines.some((l) => l.viaFamily || l.role === 'family') &&
                      <span className="pr-family" title={t.familyHint}>👨‍👩‍👧 Family Ticket</span>}
                    {p.menus && p.menus.child != null && (
                      <span className="pr-menu" title={t.menuHint}>🍿 {t.menuChild} +{fmtEur(p.menus.child, t.locale)}</span>
                    )}
                    {!p.exact && <span className="pr-est" title={t.estimateHint}>≈ {t.estimated}</span>}
                    {byPrice && i === 0 && <span className="pr-best">★ {t.cheapestBadge}</span>}
                  </div>
                </li>
              ))}
            </ul>
            {priced.length > limit && (
              <button className="price-more" onClick={() => setLimit(limit + 25)}>
                {t.showMorePrices(priced.length - limit)}
              </button>
            )}
          </>
        )}
        {(n === 0 || priced.length === 0) && (
          <p className="price-empty">{n === 0 ? t.partyLabel : t.noPriceShows}</p>
        )}
        {cinemas.length === 0 && <p className="price-empty">{t.priceCinemaHint}</p>}

        {(cinemas.length ? cinemas : Object.keys(CINEMA_PRICES)).map((c) => (
          <PriceReference key={c} cinema={c} cfg={CINEMA_PRICES[c]} t={t} ui={ui} />
        ))}
      </div>
    </div>
  )
}

// TV-guide style view: all filtered screenings, grouped by day, sorted by time
function DayPlan({ items, onOpen, t, ui }) {
  const byDay = {}
  for (const { m, shows } of items) {
    for (const s of shows) {
      const d = dayKey(s.datetime)
      ;(byDay[d] = byDay[d] || []).push({ m, s })
    }
  }
  return (
    <div className="plan">
      {Object.keys(byDay).sort().map((d) => (
        <section className="plan-day" key={d}>
          <h2>{fmtDayFull(d, t)}</h2>
          {byDay[d]
            .sort((a, b) => a.s.datetime.localeCompare(b.s.datetime))
            .map(({ m, s }, i) => (
              <div className="plan-row" key={i}>
                <span className="plan-time">{fmtTime(s.datetime, t)}</span>
                <button className="plan-title" onClick={() => onOpen(m)}>{displayTitle(m, ui)}</button>
                <span className={`lang-tag plan-lang lang-${s.language.toLowerCase()}`}>{s.language}</span>
                <span className="plan-cinema">{s.cinema} · {s.city}</span>
                {s.booking_url && (
                  isInfoOnly(s) ? (
                    <a className="plan-ticket plan-info" href={s.booking_url} target="_blank"
                      rel="noreferrer" title={t.infoTitle}>ℹ️ {t.info}</a>
                  ) : (
                    <a className="plan-ticket" href={s.booking_url} target="_blank" rel="noreferrer"
                      title={t.ticketsTitle}>🎟️ {t.tickets}</a>
                  )
                )}
              </div>
            ))}
        </section>
      ))}
    </div>
  )
}

// One dropdown for all three bar menus.
//
// The menu is rendered `position: fixed` and positioned from the button's
// rectangle rather than being laid out inside the button's own box. That is
// deliberate: the buttons live in a side-scrolling row, and a scroll container
// clips everything inside it — an absolutely positioned menu was being cut off
// entirely on narrow screens, which made Datum / Stadt / Sortierung look dead.
function Menu({ label, on, title, menuClass = '', children }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const wrapRef = useRef(null)
  const menuRef = useRef(null)

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const r = wrapRef.current.getBoundingClientRect()
    const w = menuRef.current?.offsetWidth || 180
    setPos({
      top: r.bottom + 6,
      // keep it on screen when its button sits near the right edge
      left: Math.max(10, Math.min(r.left, window.innerWidth - w - 10)),
      maxHeight: Math.max(160, window.innerHeight - r.bottom - 20),
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    // it is pinned to the viewport, so anything that moves the button (page
    // scroll, the row scrolling sideways, a resize) closes it instead of
    // leaving it floating somewhere wrong. The listener is on capture, which
    // means it also sees the menu's OWN list scrolling — and closed the menu
    // the moment anyone tried to scroll down the list of days. Scrolls that
    // start inside the menu move nothing, so they are ignored.
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const close = () => setOpen(false)
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div className="dropdown" ref={wrapRef}>
      <button className={`chip ${on ? 'on' : ''}`} onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox" aria-expanded={open} title={title}>
        {label} <span className="caret">▾</span>
      </button>
      {open && (
        <div className={`dropdown-menu ${menuClass}`} role="listbox" ref={menuRef}
          style={pos
            ? { top: pos.top, left: pos.left, maxHeight: pos.maxHeight }
            : { opacity: 0, pointerEvents: 'none' }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

// one option row inside a Menu
function MenuItem({ selected, onClick, children }) {
  return (
    <button role="option" aria-selected={selected} className={selected ? 'on' : ''} onClick={onClick}>
      {children}
    </button>
  )
}

// one compact dropdown for all sort options
function SortMenu({ sort, setSort, t }) {
  const lbl = (o) => `${o.icon} ${o.labelKey ? t[o.labelKey] : o.label}`
  const active = SORT_OPTIONS.find((o) => o.id === sort) || SORT_OPTIONS[0]
  return (
    <Menu label={lbl(active)} title={t.sortLabel}>
      {(close) => SORT_OPTIONS.map((o) => (
        <MenuItem key={o.id} selected={sort === o.id} onClick={() => { setSort(o.id); close() }}>
          {lbl(o)}
        </MenuItem>
      ))}
    </Menu>
  )
}

// City picker dropdown (Both cities · Köln · Bonn)
function CityMenu({ city, setCity, t }) {
  const opts = [['Alle', t.cityAll], ['Köln', 'Köln'], ['Bonn', 'Bonn']]
  return (
    <Menu label={`📍 ${city === 'Alle' ? t.cityAll : city}`} on={city !== 'Alle'}>
      {(close) => opts.map(([v, l]) => (
        <MenuItem key={v} selected={city === v} onClick={() => { setCity(v); close() }}>{l}</MenuItem>
      ))}
    </Menu>
  )
}

// Single date dropdown: Alle Tage · Heute · Morgen · every upcoming day.
// (Replaces the scrollable day-chip row, which also clipped its own popover.)
function DateMenu({ date, setDate, allDates, t }) {
  return (
    <Menu label={`📅 ${date === 'Alle' ? t.allDays : fmtDayShort(date, t)}`}
      on={date !== 'Alle'} menuClass="daymenu">
      {(close) => (
        <>
          <MenuItem selected={date === 'Alle'} onClick={() => { setDate('Alle'); close() }}>
            {t.allDays}
          </MenuItem>
          {allDates.map((d) => (
            <MenuItem key={d} selected={date === d} onClick={() => { setDate(d); close() }}>
              {fmtDayShort(d, t)}
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  )
}

// The bar's buttons sit on one line and scroll sideways when they don't fit.
// On their own that is invisible — so the edge that has more behind it gets a
// fade plus a real arrow button you can tap to scroll, and both disappear once
// you reach that end.
function ScrollRow({ className = '', children }) {
  const ref = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const max = el.scrollWidth - el.clientWidth
      setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    // the buttons change width when the UI language or the picked date changes
    const ro = new ResizeObserver(update)
    ro.observe(el)
    for (const c of el.children) ro.observe(c)
    return () => { el.removeEventListener('scroll', update); ro.disconnect() }
  }, [children])
  const nudge = (dir) => ref.current?.scrollBy({ left: dir * 200, behavior: 'smooth' })
  return (
    <div className={`scrollrow ${edges.left ? 'has-left' : ''} ${edges.right ? 'has-right' : ''}`}>
      <div className={`scrollrow-track ${className}`} ref={ref}>{children}</div>
      <button className="scrollrow-arrow left" onClick={() => nudge(-1)} tabIndex={-1} aria-hidden="true">‹</button>
      <button className="scrollrow-arrow right" onClick={() => nudge(1)} tabIndex={-1} aria-hidden="true">›</button>
    </div>
  )
}

// Everything the visitor has switched on, as one row of removable chips. This
// is what keeps the bar itself short: the bar offers the four things people
// reach for most, the chips show the rest without another menu to open.
function ActiveChips({ chips, onResetAll, t }) {
  if (chips.length === 0) return null
  return (
    <div className="chips-row" role="group" aria-label={t.activeFilters}>
      {chips.map((c) => (
        <button className="active-chip" key={c.key} onClick={c.clear} title={t.clearOne(c.label)}>
          {c.label} <span className="x">✕</span>
        </button>
      ))}
      <button className="chips-reset" onClick={onResetAll}>↺ {t.resetAll}</button>
    </div>
  )
}

// Appears once the visitor has scrolled past the first screenful. Uses a
// sentinel + IntersectionObserver instead of a scroll listener, so scrolling
// stays smooth (no work on the main thread per scroll event).
function BackToTop({ t }) {
  // seeded from the current position so a restored deep scroll shows it at once
  const [show, setShow] = useState(() => window.scrollY > 460)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <>
      <div ref={ref} className="top-sentinel" aria-hidden="true" />
      <button className={`to-top ${show ? 'on' : ''}`} aria-hidden={!show} tabIndex={show ? 0 : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        title={t.backToTop} aria-label={t.backToTop}>
        {/* drawn, not the ↑ character: the glyph is far too thin at this size */}
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
          strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20V6M5.5 12.5L12 6l6.5 6.5" />
        </svg>
      </button>
    </>
  )
}

// --- main app --------------------------------------------------------------
export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const [ui, setUi] = useState(() => localStorage.getItem('kinoguide-lang') || 'de')
  useEffect(() => { localStorage.setItem('kinoguide-lang', ui) }, [ui])
  const t = T[ui]

  // filters start from the URL, so filtered views are shareable links
  const p0 = new URLSearchParams(window.location.search)
  const csv = (k) => (p0.get(k) || '').split(',').filter(Boolean)

  const [q, setQ] = useState(() => p0.get('q') || '')
  const [city, setCity] = useState(() => p0.get('stadt') || 'Alle')
  const [lang, setLang] = useState(() => p0.get('fassung') || 'alle')
  const [sort, setSort] = useState(() => p0.get('sort') || 'imdb')
  const [minImdb, setMinImdb] = useState(() => +(p0.get('imdb') || 0))
  const [genres, setGenres] = useState(() => csv('genres'))
  const [kidsOnly, setKidsOnly] = useState(() => p0.get('kinder') === '1')
  const [cinema, setCinema] = useState(() => p0.get('kino') || 'Alle')
  const [date, setDate] = useState(() => p0.get('datum') || 'Alle')
  const [timeFrom, setTimeFrom] = useState(() => +(p0.get('von') || 0))
  const [timeTo, setTimeTo] = useState(() => +(p0.get('bis') || 24))
  const [topics, setTopics] = useState(() => csv('themen'))
  const [origLangs, setOrigLangs] = useState(() => csv('sprachen'))
  const [lastMinute, setLastMinute] = useState(() => p0.get('lm') === '1')
  const [view, setView] = useState(() => (p0.get('ansicht') === 'plan' ? 'plan' : 'grid'))
  // which film's page we're on (?film=…) — null means the overview
  const [filmId, setFilmId] = useState(() => p0.get('film') || null)
  // the static sub-pages (?seite=kontakt); they route exactly like a film page
  const [page, setPage] = useState(() => (p0.get('seite') === 'kontakt' ? 'kontakt' : null))
  // one key for "which page are we on", so the history and scroll logic below
  // treat a film page and a static page the same way
  const route = filmId ? `film:${filmId}` : page ? `seite:${page}` : null

  // Keep the URL in sync. Filter changes only *replace* the entry (no history
  // spam), but opening or leaving a film page *pushes* one — that is what makes
  // the browser's own Back button walk from the film page back to the list.
  const lastFilm = useRef(route)
  const fromPop = useRef(false)
  useEffect(() => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (city !== 'Alle') sp.set('stadt', city)
    if (lang !== 'alle') sp.set('fassung', lang)
    if (sort !== 'imdb') sp.set('sort', sort)
    if (minImdb > 0) sp.set('imdb', String(minImdb))
    if (genres.length) sp.set('genres', genres.join(','))
    if (kidsOnly) sp.set('kinder', '1')
    if (cinema !== 'Alle') sp.set('kino', cinema)
    if (date !== 'Alle') sp.set('datum', date)
    if (timeFrom > 0) sp.set('von', String(timeFrom))
    if (timeTo < 24) sp.set('bis', String(timeTo))
    if (topics.length) sp.set('themen', topics.join(','))
    if (origLangs.length) sp.set('sprachen', origLangs.join(','))
    if (lastMinute) sp.set('lm', '1')
    if (view !== 'grid') sp.set('ansicht', view)
    if (filmId) sp.set('film', filmId)
    if (page) sp.set('seite', page)
    const qs = sp.toString()
    const url = qs ? `?${qs}` : window.location.pathname
    const navigated = route !== lastFilm.current
    lastFilm.current = route
    // …unless we got here *because* of a Back/Forward press — then the browser
    // has already moved, and pushing would trap the visitor on the page.
    if (navigated && !fromPop.current) window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
    fromPop.current = false
  }, [q, city, lang, sort, minImdb, genres, kidsOnly, cinema, date, timeFrom, timeTo, topics, origLangs, lastMinute, view, filmId, page, route])

  // Back/Forward: adopt whatever page the URL now points at
  useEffect(() => {
    const onPop = () => {
      fromPop.current = true
      const sp = new URLSearchParams(window.location.search)
      setFilmId(sp.get('film') || null)
      setPage(sp.get('seite') === 'kontakt' ? 'kontakt' : null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // price panel: who's coming survives reloads, so the "ab X €" hints on the
  // cinema rows are already personalised on the next visit
  const [priceView, setPriceView] = useState(null) // null | { movie: Movie|null }
  const [party, setParty] = useState(() => {
    try { return { ...DEFAULT_PARTY, ...JSON.parse(localStorage.getItem('kinoguide-party')) } }
    catch { return DEFAULT_PARTY }
  })
  const [threeD, setThreeD] = useState(false)
  useEffect(() => { localStorage.setItem('kinoguide-party', JSON.stringify(party)) }, [party])

  // The cinema's own per-screening prices (scraped daily). Fetched on first
  // use, not on load — nobody pays for it who never opens the price panel, and
  // if it's missing the curated table takes over.
  const [livePrices, setLivePrices] = useState(null)
  const wantPrices = !!priceView || !!filmId
  useEffect(() => {
    if (!wantPrices || livePrices) return
    fetch('data/prices.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setLivePrices(j))
      .catch(() => {})
  }, [wantPrices, livePrices])

  // favorites survive reloads via localStorage
  const [favs, setFavs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kinoguide-favs')) || [] } catch { return [] }
  })
  const [favsOnly, setFavsOnly] = useState(false)
  useEffect(() => {
    localStorage.setItem('kinoguide-favs', JSON.stringify(favs))
  }, [favs])
  const toggleFav = (id) =>
    setFavs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  // index.html kicks this fetch off before the JS bundle has even downloaded,
  // so by the time React mounts the program is usually already on its way in.
  useEffect(() => {
    const req = window.__movies ||
      fetch('data/movies.json').then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
    req.then((d) => { CINEMA_META = d.cinemas || {}; setData(d) })
      .catch((e) => setError(String(e)))
  }, [])

  // original languages present in the data, most common first, for the
  // language filter buttons (German excluded — it's the home language)
  const allLangs = useMemo(() => {
    if (!data) return []
    const count = {}
    for (const m of data.movies) {
      const l = m.original_language
      if (l && l !== 'de') count[l] = (count[l] || 0) + 1
    }
    // every language actually in the program gets a button, even with a single
    // film: a lone Ukrainian or Malayalam film was previously unreachable by
    // this filter (the old cutoff was 2). Sorted by how many films carry it.
    const list = Object.entries(count)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([code, n]) => ({ code, n }))
    // pinned languages stay on offer even with nothing playing; they carry
    // their count so an empty day says so before you click
    for (const code of PINNED_LANGS) {
      if (!count[code]) list.push({ code, n: 0 })
    }
    return list
  }, [data])

  // option lists derived from the data
  const allGenres = useMemo(() => {
    if (!data) return []
    const set = new Set()
    for (const m of data.movies) for (const g of m.genres || []) set.add(g)
    return [...set].sort((a, b) => a.localeCompare(b, 'de'))
  }, [data])

  const allCinemas = useMemo(() => {
    if (!data) return []
    const set = new Set()
    for (const m of data.movies) for (const s of m.showtimes) set.add(s.cinema)
    return [...set].sort((a, b) => a.localeCompare(b, 'de'))
  }, [data])

  const allDates = useMemo(() => {
    if (!data) return []
    const today = dayKey(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString())
    const set = new Set()
    for (const m of data.movies) for (const s of m.showtimes) {
      const d = dayKey(s.datetime)
      if (d >= today) set.add(d)
    }
    return [...set].sort()
  }, [data])

  // showtimes of a movie that pass the when/where/version filters
  const showsFor = (m) => m.showtimes.filter((s) => {
    // hide screenings that ended: data refreshes only each morning, but
    // through the day past shows should drop out (30 min grace for latecomers)
    if (new Date(s.datetime) < Date.now() - 30 * 60000) return false
    if (!matchesLang(s, lang)) return false
    if (city !== 'Alle' && s.city !== city) return false
    if (cinema !== 'Alle' && s.cinema !== cinema) return false
    if (date !== 'Alle' && dayKey(s.datetime) !== date) return false
    if (lastMinute) {
      const diff = new Date(s.datetime) - Date.now()
      if (diff < 0 || diff > 4 * 3600 * 1000) return false
    }
    const d = new Date(s.datetime)
    const hour = d.getHours() + d.getMinutes() / 60
    if (hour < timeFrom || hour > timeTo) return false
    return true
  })

  // diacritic-insensitive search: "tochter" finds "Töchter", "leon" finds "Léon"
  const fold = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  // lenient match: every search word must appear in the title (any order),
  // and a word matches if it's a substring OR within one typo (edit distance
  // ≤1 for words ≥4 chars). So "intersteller", "hail mary project", "godzila"
  // all still find the film.
  const within1 = (a, b) => {
    if (Math.abs(a.length - b.length) > 1) return false
    let i = 0, j = 0, edits = 0
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue }
      if (++edits > 1) return false
      if (a.length > b.length) i++
      else if (a.length < b.length) j++
      else { i++; j++ }
    }
    return edits + (a.length - i) + (b.length - j) <= 1
  }
  const wordMatches = (word, hay) => {
    if (hay.includes(word)) return true
    if (word.length < 4) return false
    return hay.split(/\s+/).some((w) => within1(word, w))
  }

  // The text box stays instantly responsive while React re-filters the grid at
  // a lower priority — no dropped keystrokes on a slow phone.
  const qLive = useDeferredValue(q)
  const favKey = favsOnly ? favs.join(',') : ''

  const movies = useMemo(() => {
    if (!data) return []
    const words = fold(qLive.trim()).split(/\s+/).filter(Boolean)
    const favSet = favsOnly ? new Set(favs) : null
    const collator = new Intl.Collator(t.locale)   // one, not one per comparison
    // one pass instead of a chain of .filter()s: with ~250 films × ~1500
    // screenings this runs on every keystroke, so the intermediate arrays add up
    const out = []
    for (const m of data.movies) {
      if (favSet && !favSet.has(m.id)) continue
      if ((m.ratings.imdb ?? 0) < minImdb) continue
      if (kidsOnly && !isKidsFilm(m)) continue
      if (genres.length && !(m.genres || []).some((g) => genres.includes(g))) continue
      if (!topics.every((tg) => matchTopic(m, tg))) continue   // AND: each selected topic must match
      if (origLangs.length && !origLangs.includes(m.original_language)) continue
      if (words.length) {
        const hay = fold(m.title_de) + ' ' + fold(m.title_original)
        if (!words.every((w) => wordMatches(w, hay))) continue
      }
      const shows = showsFor(m)
      if (shows.length) out.push({ m, shows })
    }
    return out
      .sort((a, b) => {
        // in last-minute mode the soonest screening comes first
        if (lastMinute) return a.shows[0].datetime.localeCompare(b.shows[0].datetime)
        // 'A–Z' = all films alphabetically by their displayed title
        if (sort === 'alpha') return collator.compare(displayTitle(a.m, ui), displayTitle(b.m, ui))
        // 'Neu' = newest theatrical release first (full date, not just year).
        // Far-future dates (event cinema announced for next season) sort last —
        // they haven't "hit cinemas" yet. Two weeks of lead time still counts
        // so preview screenings of this week's releases show up.
        if (sort === 'recent') {
          const horizon = new Date(Date.now() + 14 * 86400e3).toISOString().slice(0, 10)
          const rd = (m) => {
            const d = m.release_date || (m.year ? `${m.year}` : '')
            return d > horizon ? '' : d
          }
          return rd(b.m).localeCompare(rd(a.m))
        }
        return (b.m.ratings[sort] ?? -1) - (a.m.ratings[sort] ?? -1)
      })
    // favKey, not favs: hearting a film must not re-filter the whole list
    // unless the "Favoriten" filter is actually on
  }, [data, qLive, city, lang, sort, minImdb, genres, kidsOnly, cinema, date, timeFrom, timeTo, favsOnly, favKey, topics, origLangs, lastMinute, ui, t.locale])

  // screenings the price panel works on: one film's, or every filtered
  // screening at a cinema we have prices for
  const priceItems = useMemo(() => {
    if (!priceView) return []
    if (priceView.movie) {
      return showsFor(priceView.movie)
        .filter((s) => CINEMA_PRICES[s.cinema])
        .map((s) => ({ m: priceView.movie, s }))
    }
    const out = []
    for (const { m, shows } of movies) {
      for (const s of shows) if (CINEMA_PRICES[s.cinema]) out.push({ m, s })
    }
    return out
  }, [priceView, movies])

  // --- film page ------------------------------------------------------------
  // Looked up in the *whole* program, not the filtered list, so a shared link
  // like ?film=tt0167260 opens the film even when the recipient's filters
  // (or ours, saved in the same link) would hide it.
  const selected = useMemo(
    () => (filmId && data ? data.movies.find((m) => m.id === filmId) || null : null),
    [filmId, data])

  // the scroll position has to be taken *now*: the moment React swaps the long
  // list for the much shorter film page, the browser clamps scrollY to the new
  // page height and the original position is gone
  const openMovie = (m) => { listScroll.current = window.scrollY; setFilmId(m.id) }
  const openPage = (p) => {
    // only the list has a scroll position worth keeping — the header button is
    // reachable from a film page too, and that must not clobber it
    if (!route) listScroll.current = window.scrollY
    setFilmId(null); setPriceView(null); setPage(p)
  }
  const backToList = () => {
    // prefer real history so Back/Forward stay consistent with the buttons
    if (window.history.length > 1) window.history.back()
    else { setFilmId(null); setPage(null) }
  }

  // Leaving the list parks the scroll position; coming back restores it, so a
  // visitor who was 40 films deep doesn't land at the top again.
  const listScroll = useRef(0)
  const wasFilm = useRef(route)
  // the browser's own restoration fires after ours and would undo it — this is
  // a single-page app, so we take the wheel
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  }, [])
  useLayoutEffect(() => {
    const onFilm = !!route
    if (route === wasFilm.current) return
    if (onFilm) {
      window.scrollTo(0, 0)
    } else {
      const y = listScroll.current
      // read scrollHeight first: it forces the browser to lay the grid back out,
      // otherwise the page is still "short" and the jump gets clamped
      void document.documentElement.scrollHeight
      window.scrollTo(0, y)
      // posters can still be settling — one more go on the next frame
      if (Math.abs(window.scrollY - y) > 2) requestAnimationFrame(() => window.scrollTo(0, y))
    }
    wasFilm.current = route
  }, [route])

  // the tab title follows the film, which is what a shared or bookmarked link
  // should read as
  useEffect(() => {
    document.title = selected
      ? `${displayTitle(selected, ui)} · Kino Köln Bonn`
      : page === 'kontakt'
      ? `${t.contact} · Kino Köln Bonn`
      : 'Kino Köln Bonn'
  }, [selected, page, ui, t])

  const toggleGenre = (g) =>
    setGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])

  const toggleTopic = (tg) =>
    setTopics((prev) => prev.includes(tg) ? prev.filter((x) => x !== tg) : [...prev, tg])

  const toggleLang = (code) =>
    setOrigLangs((prev) => prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code])

  const resetFilters = () => {
    setQ(''); setCity('Alle'); setLang('alle'); setMinImdb(0); setGenres([])
    setKidsOnly(false); setCinema('Alle'); setDate('Alle'); setTimeFrom(0); setTimeTo(24)
    setTopics([]); setOrigLangs([]); setLastMinute(false)
  }

  // full reset to the fresh-landing state (keeps language + saved favorites):
  // used by the top "Reset" button and by clicking the logo. The URL-sync
  // effect then clears the query string on its own.
  const resetAll = () => {
    resetFilters()
    setSort('imdb'); setFavsOnly(false); setView('grid')
    setShowFilters(false); setFilmId(null); setPage(null); setPriceView(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Every filter that is on, as one removable chip. The four controls in the
  // bar (date, city, sort, filter) are left out — they show their own state.
  const activeChips = []
  const chip = (key, label, clear) => activeChips.push({ key, label, clear })
  if (q) chip('q', `„${q}“`, () => setQ(''))
  if (lastMinute) chip('lm', t.lastMinute, () => setLastMinute(false))
  if (kidsOnly) chip('kids', t.kids, () => setKidsOnly(false))
  for (const tg of topics) chip(`topic-${tg}`, t.topics[tg], () => toggleTopic(tg))
  if (lang !== 'alle') chip('lang', LANGS.find((l) => l.id === lang)?.labelKey
    ? t[LANGS.find((l) => l.id === lang).labelKey] : 'OV / OmU', () => setLang('alle'))
  for (const g of genres) chip(`genre-${g}`, genreName(g, ui), () => toggleGenre(g))
  for (const code of origLangs) chip(`ol-${code}`, `${langFlag(code)}${langName(code, ui)}`, () => toggleLang(code))
  if (cinema !== 'Alle') chip('cinema', `📍 ${cinema}`, () => setCinema('Alle'))
  if (minImdb > 0) chip('imdb', `⭐ ${minImdb.toFixed(1)}+`, () => setMinImdb(0))
  if (timeFrom > 0 || timeTo < 24) {
    const hh = (h) => `${String(h).padStart(2, '0')}:00`
    chip('time', `🕒 ${hh(timeFrom)}–${timeTo === 24 ? '24:00' : hh(timeTo)}`,
      () => { setTimeFrom(0); setTimeTo(24) })
  }
  if (favsOnly) chip('favs', `♥ ${t.favorites}`, () => setFavsOnly(false))

  // how many filters the panel itself is holding, for the badge on its button
  const panelCount = activeChips.filter((c) => !['q', 'favs'].includes(c.key)).length

  return (
    <div className="page">
      <header className="topbar">
        {/* the DE/EN switch sits at the very left edge of the header, ahead of
            the logo — asked for 2026-08-01 because it read as "in the middle"
            while it was the first item of the right-hand group */}
        {/* Flags are drawn, not the 🇩🇪/🇬🇧 emoji: Windows ships no flag glyphs
            at all, so the emoji degrades to the bare letters "DE"/"GB" in a box
            on every Windows browser. Both are given the same 3:2 box so the two
            buttons match — the Union Jack is built in a 60×40 viewBox for it. */}
        <div className="lang-switch" role="group" aria-label="Sprache / Language">
          <button className={ui === 'de' ? 'on' : ''} onClick={() => setUi('de')}
            aria-pressed={ui === 'de'} title="Deutsch" aria-label="Deutsch">
            <svg className="flag" viewBox="0 0 3 2" aria-hidden="true" focusable="false">
              <rect width="3" height="2" fill="#000" />
              <rect y="0.6667" width="3" height="1.3333" fill="#dd0000" />
              <rect y="1.3333" width="3" height="0.6667" fill="#ffce00" />
            </svg>
          </button>
          <button className={ui === 'en' ? 'on' : ''} onClick={() => setUi('en')}
            aria-pressed={ui === 'en'} title="English" aria-label="English">
            <svg className="flag" viewBox="0 0 60 40" aria-hidden="true" focusable="false">
              {/* the counterchange: the red diagonals only show in two opposite
                  quadrants, which is what this clip carves out */}
              <clipPath id="uj-quarters">
                <path d="M30,20 h30 v20 z v20 h-30 z h-30 v-20 z v-20 h30 z" />
              </clipPath>
              <rect width="60" height="40" fill="#00247d" />
              <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="8" />
              <path d="M0,0 L60,40 M60,0 L0,40" stroke="#cf142b" strokeWidth="5"
                clipPath="url(#uj-quarters)" />
              <path d="M30,0 v40 M0,20 h60" stroke="#fff" strokeWidth="13" />
              <path d="M30,0 v40 M0,20 h60" stroke="#cf142b" strokeWidth="8" />
            </svg>
          </button>
        </div>
        {/* "Kino", not "Kinoguide" (2026-08-01): the long word wrapped the logo
            onto two lines on every phone and cost a whole header row */}
        <button className="brand" onClick={resetAll} title={t.backHome}>Kino <span>Köln · Bonn</span></button>
        <div className="topbar-right">
          {data && <div className="stand">{t.stand} {new Date(data.generated_at).toLocaleDateString(t.locale)}</div>}
          {/* drawn rather than the ✉ emoji: the emoji renders hairline-thin in
              most fonts and the orange barely registered against the navy */}
          <button className={`mail-btn${page === 'kontakt' ? ' on' : ''}`}
            onClick={() => openPage('kontakt')}
            title={t.contactBtn} aria-label={t.contactBtn}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
              fill="none" stroke="currentColor" strokeWidth="2.6"
              strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.2" y="4.8" width="19.6" height="14.4" rx="2.2" />
              <path d="M3 6.6 L12 13.4 L21 6.6" />
            </svg>
          </button>
        </div>
      </header>
      <div className="marquee-strip" aria-hidden="true"></div>

      {page === 'kontakt' ? (
        <ContactPage onBack={backToList} t={t} />
      ) : filmId ? (
        selected ? (
          <FilmPage
            movie={selected}
            shows={showsFor(selected)}
            allShows={selected.showtimes.filter((s) => new Date(s.datetime) >= Date.now() - 30 * 60000)}
            onBack={backToList}
            onPrices={() => setPriceView({ movie: selected })}
            party={party} threeD={threeD} live={livePrices}
            isFav={favs.includes(selected.id)} onToggleFav={toggleFav}
            t={t} ui={ui} />
        ) : (
          <p className="empty">
            {error ? t.loadError(error) : !data ? t.loading : t.notFound}
            {data && <><br /><button className="film-back" onClick={backToList}>{t.backToList}</button></>}
          </p>
        )
      ) : (
      <>
      {/* One bar, four controls: search + the three things people actually
          reach for, and a single Filter button for everything else. */}
      <div className="filterbar">
        <div className="search">
          <span className="search-icon">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} />
          {q && (
            <button className="search-clear" onClick={() => setQ('')} aria-label={t.clearSearch} title={t.clearSearch}>✕</button>
          )}
        </div>
        <ScrollRow className="filterbar-btns">
          <DateMenu date={date} setDate={setDate} allDates={allDates} t={t} />
          <CityMenu city={city} setCity={setCity} t={t} />
          <SortMenu sort={sort} setSort={setSort} t={t} />
          <button className={`chip filter-chip ${showFilters ? 'open' : ''} ${panelCount ? 'on' : ''}`}
            onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            ⚙ {t.filter}{panelCount ? <span className="chip-count">{panelCount}</span> : null}
          </button>
          {/* the price finder rides in the bar rather than the results row: it
              is a thing people go looking for, not a property of the result set */}
          <button className="chip price-chip" onClick={() => setPriceView({ movie: null })}
            title={t.pricesBtnTitle}>💶 {t.prices}</button>
        </ScrollRow>
      </div>

      <ActiveChips chips={activeChips} onResetAll={resetAll} t={t} />

      {showFilters && (
        <section className="panel">
          {/* four plain-language groups instead of one long stack of controls */}
          <div className="panel-group">
            <h3 className="panel-title">{t.quickFilters}</h3>
            <div className="pills">
              <button className={`pill ${lastMinute ? 'on' : ''}`} onClick={() => setLastMinute((v) => !v)}
                title={t.lastMinuteTitle}>{t.lastMinute}</button>
              <button className={`pill ${kidsOnly ? 'on' : ''}`} onClick={() => setKidsOnly((v) => !v)}
                title={t.kidsTitle}>{t.kids}</button>
              {TOPIC_IDS.map((tg) => (
                <button key={tg} className={`pill ${topics.includes(tg) ? 'on' : ''}`} onClick={() => toggleTopic(tg)}>
                  {t.topics[tg]}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-group">
            <h3 className="panel-title">{t.groupWhen}</h3>
            <div className="grid2">
              <div className="field">
                <label>{t.dateLabel}</label>
                <select value={date} onChange={(e) => setDate(e.target.value)}>
                  <option value="Alle">{t.allDays}</option>
                  {allDates.map((d) => <option key={d} value={d}>{fmtDayShort(d, t)}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{t.timeLabel} <b>{String(timeFrom).padStart(2, '0')}:00 – {timeTo === 24 ? '24:00' : String(timeTo).padStart(2, '0') + ':00'}</b></label>
                <div className="time-sliders">
                  <input type="range" min="0" max="24" value={timeFrom} onChange={(e) => setTimeFrom(Math.min(+e.target.value, timeTo))} />
                  <input type="range" min="0" max="24" value={timeTo} onChange={(e) => setTimeTo(Math.max(+e.target.value, timeFrom))} />
                </div>
              </div>
            </div>
          </div>

          <div className="panel-group">
            <h3 className="panel-title">{t.groupWhere}</h3>
            <div className="grid2">
              <div className="field">
                <label>{t.cinemaLabel}</label>
                <select value={cinema} onChange={(e) => setCinema(e.target.value)}>
                  <option value="Alle">{t.allCinemas}</option>
                  {allCinemas.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{t.cityAll}</label>
                <select value={city} onChange={(e) => setCity(e.target.value)}>
                  {CITIES.map((c) => <option key={c} value={c}>{c === 'Alle' ? t.cityAll : c}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="panel-group">
            <h3 className="panel-title">{t.groupWhat}</h3>
            <div className="field">
              <label>{t.version}</label>
              <div className="pills">
                {LANGS.map((l) => (
                  <button key={l.id} className={`pill ${lang === l.id ? 'on' : ''}`} onClick={() => setLang(l.id)}>
                    {l.labelKey ? t[l.labelKey] : l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>{t.genres}</label>
              <div className="pills">
                {allGenres.map((g) => (
                  <button key={g} className={`pill ${genres.includes(g) ? 'on' : ''}`} onClick={() => toggleGenre(g)}>{genreName(g, ui)}</button>
                ))}
              </div>
            </div>
            {allLangs.length > 0 && (
              <div className="field">
                <label>{t.origLangLabel}</label>
                {/* the zero-film class must not be a bare "empty": that class
                    already exists for the "no films" message and its 60px
                    padding blew these pills up into bubbles */}
                <div className="pills">
                  {allLangs.map(({ code, n }) => (
                    <button key={code} className={`pill ${origLangs.includes(code) ? 'on' : ''} ${n === 0 ? 'pill-none' : ''}`}
                      onClick={() => toggleLang(code)}>
                      {langFlag(code)}{langName(code, ui)}
                      {n === 0 && <span className="pill-zero">0</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="field">
              <label>{t.imdbMin} <b>{minImdb === 0 ? t.anyRating : minImdb.toFixed(1)}</b></label>
              <input type="range" min="0" max="9" step="0.5" value={minImdb} onChange={(e) => setMinImdb(+e.target.value)} />
            </div>
          </div>

          <div className="panel-foot">
            <button className="reset" onClick={resetFilters}>{t.reset}</button>
            <button className="panel-done" onClick={() => setShowFilters(false)}>
              {data ? `${movies.length} ${t.films}` : t.filter} ✓
            </button>
          </div>
        </section>
      )}

      {/* what came back, and how to look at it */}
      <div className="resultbar">
        {data && <span className="count">{movies.length} {t.films}</span>}
        <div className="resultbar-right">
          {favs.length > 0 && (
            <button className={`chip fav-chip ${favsOnly ? 'on' : ''}`} onClick={() => setFavsOnly((v) => !v)}>
              ♥ {favs.length}
            </button>
          )}
          <div className="view-switch" role="group" aria-label="Ansicht">
            <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} title={t.viewGrid}>▦</button>
            <button className={view === 'plan' ? 'on' : ''} onClick={() => setView('plan')} title={t.viewPlan}>☰</button>
          </div>
        </div>
      </div>

      <main>
        {error && <p className="empty">{t.loadError(error)}</p>}
        {!error && !data && <p className="empty">{t.loading}</p>}
        {data && movies.length === 0 && <p className="empty">{t.empty}</p>}
        {view === 'plan' ? (
          <DayPlan items={movies} onOpen={openMovie} t={t} ui={ui} />
        ) : (
          <div className="grid">
            {movies.map(({ m }, i) => (
              <Card key={`${m.id}-${i}`} movie={m} onOpen={openMovie}
                isFav={favs.includes(m.id)} onToggleFav={toggleFav} t={t} ui={ui} sort={sort} />
            ))}
          </div>
        )}
      </main>
      </>
      )}

      {priceView && (
        <PriceModal items={priceItems} movie={priceView.movie}
          party={party} setParty={setParty} threeD={threeD} setThreeD={setThreeD}
          live={livePrices}
          onClose={() => setPriceView(null)}
          onOpenMovie={(m) => { setPriceView(null); openMovie(m) }}
          t={t} ui={ui} />
      )}

      <BackToTop t={t} />

      <footer>
        <p className="credits">
          {t.thanksPre}{' '}
          <a href="https://kinoguide.fyi" target="_blank" rel="noreferrer">kinoguide.fyi</a>{' '}
          {t.thanksPost}
        </p>
        <p>{t.footer}</p>
        <p>
          <button className="footer-link" onClick={() => openPage('kontakt')}>{t.contact}</button>
        </p>
      </footer>
    </div>
  )
}
