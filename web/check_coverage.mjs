// Run the price model over the real program: how much of each cinema's
// schedule can we actually put a price on, and where does it come from?
import { readFileSync } from 'node:fs'
import { CINEMA_PRICES, priceFor, exactFor } from './src/prices.js'

const movies = JSON.parse(readFileSync('../data/movies.json', 'utf8'))
const live = JSON.parse(readFileSync('../data/prices.json', 'utf8'))
const party = { adult: 2, child: 2, reduced: 0 }

const stat = {}
for (const m of movies.movies) {
  for (const s of m.showtimes) {
    const cfg = CINEMA_PRICES[s.cinema]
    const st = (stat[s.cinema] ||= { shows: 0, priced: 0, exact: 0, family: 0, min: null, max: null })
    st.shows++
    if (!cfg) continue
    const p = priceFor(cfg, m, s, party, {}, live)
    if (!p) continue
    st.priced++
    if (p.exact) st.exact++
    if (p.family) st.family++
    if (st.min == null || p.total < st.min) st.min = p.total
    if (st.max == null || p.total > st.max) st.max = p.total
  }
}

const eur = (v) => (v == null ? '   —  ' : v.toFixed(2).padStart(6))
console.log('cinema                       shows  priced   exact  family   cheapest  dearest   (2 adults + 2 kids)')
let missing = 0
for (const [name, s] of Object.entries(stat).sort((a, b) => a[0].localeCompare(b[0]))) {
  const pct = s.shows ? Math.round((s.priced / s.shows) * 100) : 0
  console.log(`${name.padEnd(26)} ${String(s.shows).padStart(6)} ${String(s.priced).padStart(7)} ` +
    `${String(s.exact).padStart(7)} ${String(s.family).padStart(7)}   ${eur(s.min)}   ${eur(s.max)}   ${pct}%`)
  if (!CINEMA_PRICES[name]) { missing++; console.log(`   ^^ NO PRICE TABLE`) }
}
console.log(`\n${Object.keys(stat).length} cinemas in the program, ${missing} without a price table`)
process.exit(missing ? 1 : 0)
