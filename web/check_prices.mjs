// Sanity-check the price model against the figures printed on the price pages.
import { CINEMA_PRICES, dayTier, showPrice, showPriceExact, showId, tierLabels }
  from './src/prices.js'

let fails = 0
const eq = (label, got, want) => {
  const ok = Math.abs((got ?? NaN) - want) < 0.005
  if (!ok) { fails++; console.log(`  FAIL ${label}: got ${got}, want ${want}`) }
  else console.log(`  ok   ${label} = ${got}`)
}
const nul = (label, got) => {
  if (got !== null) { fails++; console.log(`  FAIL ${label}: expected null, got ${JSON.stringify(got)}`) }
  else console.log(`  ok   ${label} = null (as intended)`)
}

// 2026: 03 Aug = Mon, 06 Aug = Thu, 07 = Fri, 08 = Sat, 09 = Sun, 04 = Tue
const at = (day, hhmm) => `2026-08-${String(day).padStart(2, '0')}T${hhmm}:00+02:00`
const P = (c) => CINEMA_PRICES[c]
const KIDS = ['Animation', 'Familie', 'Komödie', 'Abenteuer']   // Toy Story 5
const ROMCOM = ['Komödie', 'Liebesfilm']                        // Liebe braucht keine Ferien
const one = (cat) => ({ adult: cat === 'adult' ? 1 : 0, child: cat === 'child' ? 1 : 0, reduced: cat === 'reduced' ? 1 : 0 })

console.log('\n== structural sanity: every price row matches the tier count ==')
for (const [name, cfg] of Object.entries(CINEMA_PRICES)) {
  const n = cfg.days.length
  for (const tk of cfg.tickets) {
    if (tk.price.length !== n) { fails++; console.log(`  FAIL ${name}/${tk.id}: ${tk.price.length} prices, ${n} tiers`) }
  }
  for (const k of ['checked', 'source', 'days', 'tickets']) {
    if (!cfg[k]) { fails++; console.log(`  FAIL ${name}: missing ${k}`) }
  }
  if (tierLabels(cfg, 'en').some((l) => !l)) { fails++; console.log(`  FAIL ${name}: a tier has no English label`) }
}
console.log(`  (${Object.keys(CINEMA_PRICES).length} cinemas checked)`)

// The trap this catches: a cinema whose ticket rows leave one kind of visitor
// with nothing to buy. showPrice then returns null and the screening silently
// vanishes from the panel for exactly the families it was built for.
console.log('\n== every cinema can price every visitor on every day and hour ==')
const NO_FULL_TABLE = new Set(['Woki'])   // publishes none — see the entry
for (const [name, cfg] of Object.entries(CINEMA_PRICES)) {
  if (NO_FULL_TABLE.has(name)) { console.log(`  skip ${name} (publishes no standard price)`); continue }
  const gaps = []
  for (let day = 3; day <= 9; day++) {          // Mon 03 Aug … Sun 09 Aug 2026
    for (const hhmm of ['11:00', '15:00', '17:30', '20:00', '22:30']) {
      for (const cat of ['adult', 'child', 'reduced']) {
        for (const fsk of [0, 16]) {
          if (showPrice(cfg, at(day, hhmm), one(cat), { fsk }) == null) gaps.push(`${day}. ${hhmm} ${cat} FSK${fsk}`)
        }
      }
    }
  }
  if (gaps.length) { fails++; console.log(`  FAIL ${name}: ${gaps.length} unpriceable slots, e.g. ${gaps.slice(0, 4).join(', ')}`) }
  else console.log(`  ok   ${name}`)
}

console.log('\n== Odeon: Thursday is the cinema day, 7,00 € for everyone ==')
eq('Thu adult', showPrice(P('Odeon'), at(6, '20:00'), one('adult')).total, 7.0)
eq('Thu child', showPrice(P('Odeon'), at(6, '20:00'), one('child')).total, 7.0)
eq('Mon adult', showPrice(P('Odeon'), at(3, '20:00'), one('adult')).total, 11.0)
eq('Mon reduced', showPrice(P('Odeon'), at(3, '20:00'), one('reduced')).total, 9.0)
eq('Mon youth', showPrice(P('Odeon'), at(3, '20:00'), one('child')).total, 6.0)
console.log('  -- overlength: Odeon adds 0,50 / 1,00 / 2,00 € from 120 / 135 / 150 min')
eq('Mon adult 119 min', showPrice(P('Odeon'), at(3, '20:00'), one('adult'), { runtime: 119 }).total, 11.0)
eq('Mon adult 120 min', showPrice(P('Odeon'), at(3, '20:00'), one('adult'), { runtime: 120 }).total, 11.5)
eq('Mon adult 140 min', showPrice(P('Odeon'), at(3, '20:00'), one('adult'), { runtime: 140 }).total, 12.0)
eq('Mon adult 165 min', showPrice(P('Odeon'), at(3, '20:00'), one('adult'), { runtime: 165 }).total, 13.0)

console.log('\n== Rex am Ring: Mo–Mi 7,00 · Do 6,00 · Fr/Sa 9,00 · So ab 18:30 7,50 ==')
eq('Mon', showPrice(P('Rex am Ring'), at(3, '20:00'), one('adult')).total, 7.0)
eq('Thu', showPrice(P('Rex am Ring'), at(6, '20:00'), one('adult')).total, 6.0)
eq('Sat', showPrice(P('Rex am Ring'), at(8, '20:00'), one('adult')).total, 9.0)
eq('Sun 17:00', showPrice(P('Rex am Ring'), at(9, '17:00'), one('adult')).total, 9.0)
eq('Sun 19:00', showPrice(P('Rex am Ring'), at(9, '19:00'), one('adult')).total, 7.5)
console.log('  -- the KiFi child/family fares must NOT leak into a grown-up film')
eq('Mon, FSK 16, 1 child', showPrice(P('Rex am Ring'), at(3, '20:00'), one('child'), { fsk: 16 }).total, 7.0)
eq('Mon, FSK 0 kids film, 2 adults + 2 kids',
  showPrice(P('Rex am Ring'), at(3, '15:00'), { adult: 2, child: 2, reduced: 0 }, { fsk: 0, genres: KIDS }).total,
  2 * 6.0 + 2 * 5.0)
eq('Mon, FSK 16, 2 adults + 2 kids',
  showPrice(P('Rex am Ring'), at(3, '15:00'), { adult: 2, child: 2, reduced: 0 }, { fsk: 16 }).total, 4 * 7.0)

console.log('\n== Rex Bonn: one flat family fare of 7,50 € for the whole family ==')
eq('FSK 0 kids film, 2 adults + 2 kids',
  showPrice(P('Rex Lichtspieltheater'), at(3, '15:00'), { adult: 2, child: 2, reduced: 0 }, { fsk: 0, genres: KIDS }).total, 4 * 7.5)
eq('FSK 16, 2 adults + 2 kids (child = Schüler 9,00)',
  showPrice(P('Rex Lichtspieltheater'), at(3, '20:00'), { adult: 2, child: 2, reduced: 0 }, { fsk: 16 }).total,
  2 * 10.0 + 2 * 9.0)
console.log('  Neue Filmbühne shares the table:',
  showPrice(P('Neue Filmbühne'), at(3, '20:00'), one('adult')).total === 10.0 ? 'ok' : (fails++, 'FAIL'))

console.log('\n== Cineplex Köln: student fare only Mo–Do and Fr/Sa after 22:00 ==')
eq('Mon 20:00 adult', showPrice(P('Cineplex Köln'), at(3, '20:00'), one('adult')).total, 10.0)
eq('Mon 20:00 student', showPrice(P('Cineplex Köln'), at(3, '20:00'), one('reduced')).total, 8.5)
eq('Fri 20:00 adult', showPrice(P('Cineplex Köln'), at(7, '20:00'), one('adult')).total, 12.0)
eq('Fri 20:00 student (no discount)', showPrice(P('Cineplex Köln'), at(7, '20:00'), one('reduced')).total, 12.0)
eq('Fri 22:30 student', showPrice(P('Cineplex Köln'), at(7, '22:30'), one('reduced')).total, 10.5)
eq('Sun 22:30 student (Fr/Sa only)', showPrice(P('Cineplex Köln'), at(9, '22:30'), one('reduced')).total, 12.0)
eq('Sun 11:00 matinee', showPrice(P('Cineplex Köln'), at(9, '11:00'), one('adult')).total, 7.9)
console.log('  -- family tariff: Saturday before 17:00 only')
eq('Sat 15:00, FSK 0, 2+2', showPrice(P('Cineplex Köln'), at(8, '15:00'), { adult: 2, child: 2, reduced: 0 }, { fsk: 0 }).total, 4 * 7.9)
eq('Sat 18:00, FSK 0, 2+2', showPrice(P('Cineplex Köln'), at(8, '18:00'), { adult: 2, child: 2, reduced: 0 }, { fsk: 0 }).total, 2 * 12.0 + 2 * 7.9)
eq('Mon 15:00, FSK 0, 2+2', showPrice(P('Cineplex Köln'), at(3, '15:00'), { adult: 2, child: 2, reduced: 0 }, { fsk: 0 }).total, 2 * 10.0 + 2 * 7.9)

console.log('\n== Cinedom: family fare covers at most two grown-ups ==')
eq('Mon 15:00, FSK 0, 2 adults + 1 child',
  showPrice(P('Cinedom'), at(3, '15:00'), { adult: 2, child: 1, reduced: 0 }, { fsk: 0 }).total, 3 * 7.0)
eq('Mon 15:00, FSK 0, 3 adults + 1 child (third pays full)',
  showPrice(P('Cinedom'), at(3, '15:00'), { adult: 3, child: 1, reduced: 0 }, { fsk: 0 }).total, 2 * 7.0 + 8.0 + 7.0)
eq('Mon 18:00, FSK 0, 2+1 (after 17:00, no family fare)',
  showPrice(P('Cinedom'), at(3, '18:00'), { adult: 2, child: 1, reduced: 0 }, { fsk: 0 }).total, 2 * 8.0 + 7.0)
eq('Sat 18:00 adult', showPrice(P('Cinedom'), at(8, '18:00'), one('adult')).total, 10.0)

console.log('\n== Cinenova: 10 % online booking fee is included ==')
eq('adult 10,00 + 10 %', showPrice(P('Cinenova'), at(3, '20:00'), one('adult')).total, 11.0)
eq('adult, 125 min (+1,00 Überlänge, then +10 %)', showPrice(P('Cinenova'), at(3, '20:00'), one('adult'), { runtime: 125 }).total, 12.1)

console.log('\n== Stern Lichtspiele (CineStar) ==')
eq('Mon adult', showPrice(P('Stern Lichtspiele'), at(3, '20:00'), one('adult')).total, 11.9)
eq('Fri adult', showPrice(P('Stern Lichtspiele'), at(7, '20:00'), one('adult')).total, 12.9)
eq('Mon student (no student fare → adult)', showPrice(P('Stern Lichtspiele'), at(3, '20:00'), one('reduced')).total, 11.9)
eq('Mon child', showPrice(P('Stern Lichtspiele'), at(3, '20:00'), one('child')).total, 7.5)

console.log('\n== Woki: only the Tuesday deal is priced, the rest stays blank ==')
eq('Tue', showPrice(P('Woki'), at(4, '20:00'), one('adult')).total, 6.99)
nul('Mon', showPrice(P('Woki'), at(3, '20:00'), one('adult')))

console.log('\n== Kinopolis: unchanged behaviour after the day-tier rewrite ==')
eq('Mon 20:00 adult', showPrice(P('Kinopolis Bad Godesberg'), at(3, '20:00'), one('adult')).total, 10.99)
eq('Fri 20:00 adult', showPrice(P('Kinopolis Bad Godesberg'), at(7, '20:00'), one('adult')).total, 13.49)
eq('Sat 20:00 adult', showPrice(P('Kinopolis Bad Godesberg'), at(8, '20:00'), one('adult')).total, 13.49)
eq('Mon 11:00 matinee', showPrice(P('Kinopolis Bad Godesberg'), at(3, '11:00'), one('adult')).total, 7.49)
eq('Mon 22:00 late night', showPrice(P('Kinopolis Bad Godesberg'), at(3, '22:00'), one('adult')).total, 6.99)
eq('Mon 15:00, FSK 0 kids film, 2+2 (family)',
  showPrice(P('Kinopolis Bad Godesberg'), at(3, '15:00'), { adult: 2, child: 2, reduced: 0 }, { fsk: 0, genres: KIDS }).total, 4 * 7.49)
console.log('  -- day tiers: 03.10. is a holiday (Sat); 14.05. is Christi Himmelfahrt (Thu)')
eq('a Saturday holiday takes Sunday prices', dayTier(P('Kinopolis Bad Godesberg'), new Date('2026-10-03T20:00:00+02:00')), 3)
eq('Wed 13.05., the eve of a holiday → Fri tier', dayTier(P('Kinopolis Bad Godesberg'), new Date('2026-05-13T20:00:00+02:00')), 1)
eq('Tue 12.05., two days before → Mo–Do tier', dayTier(P('Kinopolis Bad Godesberg'), new Date('2026-05-12T20:00:00+02:00')), 0)

console.log('\n== who actually gets a family fare ==')
for (const name of ['Rex am Ring', 'Metropolis', 'Cinedom', 'Cineplex Köln', 'Kinopolis Bad Godesberg', 'Rex Lichtspieltheater']) {
  const party = { adult: 2, child: 2, reduced: 0 }
  // Saturday afternoon — inside every one of these cinemas' family windows
  const run = (o) => showPrice(P(name), at(8, '15:00'), party, o)
  const kidsFilm = run({ fsk: 0, genres: KIDS })
  const unrated = run({ fsk: null, genres: KIDS })
  const romcom = run({ fsk: 0, genres: ROMCOM })
  const ratingOnly = !P(name).familyTicket.familyFilmOnly
  const wantRomcom = ratingOnly            // Cinedom/Cineplex word their offer purely by FSK
  const ok = kidsFilm.family === true && unrated.family === false && romcom.family === wantRomcom
  if (!ok) {
    fails++
    console.log(`  FAIL ${name}: kids film ${kidsFilm.family}, unrated ${unrated.family}, FSK-0 rom-com ${romcom.family} (wanted ${wantRomcom})`)
  } else {
    console.log(`  ok   ${name}: kids film ${kidsFilm.total} · unrated ${unrated.total} (no offer) · ` +
      `FSK-0 rom-com ${romcom.total} ${wantRomcom ? '(offer applies — their rule is rating-only)' : '(no offer)'}`)
  }
}

console.log('\n== exact prices ==')
eq('Kinopolis join key', showId('https://www.kinopolis.de/bn/programm/vorstellung/74A75000023GNFNDWF') === '74A75000023GNFNDWF' ? 1 : 0, 1)
eq('Cinedom join key',
  showId('https://shop.cinedom.de/landingpage?center=9DD10000014AKQLNRG&language=DE&page=seatingplan&performance=AEC71000023RFGKYDT') === 'AEC71000023RFGKYDT' ? 1 : 0, 1)
const ex = { adult: 10, child: 8, family: 8 }
eq('2 adults + 2 kids, uncapped', showPriceExact(ex, { adult: 2, child: 2, reduced: 0 }).total, 4 * 8)
eq('3 adults + 1 kid, capped at 2', showPriceExact(ex, { adult: 3, child: 1, reduced: 0 }, 2).total, 2 * 8 + 10 + 8)
eq('no family price on the screening',
  showPriceExact({ adult: 13.5, child: 10.5 }, { adult: 2, child: 2, reduced: 0 }).total, 2 * 13.5 + 2 * 10.5)

console.log(fails ? `\n${fails} FAILURES` : '\nall checks passed')
process.exit(fails ? 1 : 0)
