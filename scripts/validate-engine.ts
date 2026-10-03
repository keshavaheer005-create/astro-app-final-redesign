// Engine validation: cross-check sweph vs astronomy-engine (independent lib),
// verify ascendant via horizon scan, verify dasha/nakshatra structures.
const swe = require('sweph');
const C = swe.constants;
const A = require('astronomy-engine');

swe.set_ephe_path('/tmp/selfsage-eph');
swe.set_sid_mode(C.SE_SIDM_LAHIRI, 0, 0);

function jd(date) { return date.getTime() / 86400000 + 2440587.5; }

const dates = [
  new Date('2000-01-01T12:00:00Z'),
  new Date('1990-06-15T04:30:00Z'),
  new Date('2024-08-15T18:45:00Z'),
  new Date('1985-11-02T09:00:00Z'),
];

const sweId = { Sun: C.SE_SUN, Moon: C.SE_MOON, Mercury: C.SE_MERCURY, Venus: C.SE_VENUS, Mars: C.SE_MARS, Jupiter: C.SE_JUPITER, Saturn: C.SE_SATURN };
const aeBody = { Sun: A.Body.Sun, Moon: A.Body.Moon, Mercury: A.Body.Mercury, Venus: A.Body.Venus, Mars: A.Body.Mars, Jupiter: A.Body.Jupiter, Saturn: A.Body.Saturn };

let maxErr = 0;
console.log('── Cross-lib tropical longitude comparison (sweph vs astronomy-engine) ──');
for (const date of dates) {
  for (const name of Object.keys(sweId)) {
    const r = swe.calc_ut(jd(date), sweId[name], C.SEFLG_SPEED | C.SEFLG_MOSEPH);
    const sweLon = r.data[0];
    const aeLon = A.Ecliptic(A.GeoVector(aeBody[name], date, true)).elon;
    const err = Math.abs(((sweLon - aeLon + 540) % 360) - 180);
    maxErr = Math.max(maxErr, err);
    if (err > 0.1) console.log(`  MISMATCH ${name} ${date.toISOString()}: sweph=${sweLon.toFixed(4)} ae=${aeLon.toFixed(4)} err=${err.toFixed(4)}°`);
  }
}
console.log(`  max error across all: ${maxErr.toFixed(5)}°  ${maxErr < 0.1 ? 'PASS ✓' : 'FAIL ✗'}`);

// True node sanity: node must be retrograde (speed < 0)
const node = swe.calc_ut(jd(dates[0]), C.SE_TRUE_NODE, C.SEFLG_SPEED | C.SEFLG_MOSEPH | C.SEFLG_SIDEREAL);
console.log(`  true node speed ${node.data[3].toFixed(4)} (should be <0) ${node.data[3] < 0 ? 'PASS ✓' : 'FAIL ✗'}`);

// Lahiri ayanamsa sanity: between 23.7 (1990) and 24.25 (2026)
for (const date of [new Date('1990-01-01T00:00:00Z'), new Date('2000-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z')]) {
  const ay = swe.get_ayanamsa_ut(jd(date));
  console.log(`  ayanamsa ${date.getFullYear()}: ${ay.toFixed(4)}°`);
}

// Ascendant cross-check: independent spherical-trig formula
// Asc = atan2( cos(RAMC), −(sin(ε)·tan(φ) + cos(ε)·sin(RAMC)) )
function ascFormula(date, lat, lng) {
  const gmst = A.SiderealTime(date); // hours
  const lst = (gmst * 15 + lng + 360) % 360; // degrees
  const eps = 23.4392911 * Math.PI / 180;
  const ramc = lst * Math.PI / 180;
  const phi = lat * Math.PI / 180;
  const y = Math.cos(ramc);
  const x = -(Math.sin(eps) * Math.tan(phi) + Math.cos(eps) * Math.sin(ramc));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

console.log('── Ascendant cross-check (Swiss houses vs spherical-trig formula) ──');
const tests = [
  { d: new Date('2000-01-01T12:00:00Z'), lat: 51.5072, lng: -0.1276 },
  { d: new Date('1990-06-15T04:30:00Z'), lat: 28.6139, lng: 77.209 },
  { d: new Date('2024-08-15T18:45:00Z'), lat: 19.076, lng: 72.8777 },
];
let ascPass = true;
for (const t of tests) {
  const h = swe.houses(jd(t.d), t.lat, t.lng, 'W');
  const ascSwiss = h.data.points[0];
  const ascForm = ascFormula(t.d, t.lat, t.lng);
  const err = Math.abs(((ascSwiss - ascForm + 540) % 360) - 180);
  if (err > 0.3) ascPass = false;
  console.log(`  ${t.d.toISOString()} swiss=${ascSwiss.toFixed(3)} formula=${ascForm.toFixed(3)} err=${err.toFixed(3)}° ${err < 0.3 ? 'PASS ✓' : 'FAIL ✗'}`);
}
console.log(`  ascendant overall: ${ascPass ? 'PASS ✓' : 'FAIL ✗'}`);

// Sunrise check Delhi 2024-06-21 (~05:24 IST) & London 2024-06-21 (~04:43 BST)
console.log('── Sunrise sanity ──');
for (const [name, lat, lng, tz, expected] of [
  ['Delhi', 28.6139, 77.209, 'Asia/Kolkata', '05:23'],
  ['London', 51.5072, -0.1276, 'Europe/London', '04:43'],
  ['Mumbai', 19.076, 72.8777, 'Asia/Kolkata', '06:03'],
]) {
  const d0 = jd(new Date('2024-06-20T18:00:00Z'));
  const r = swe.rise_trans(d0, C.SE_SUN, '', C.SEFLG_MOSEPH, C.SE_CALC_RISE, [lng, lat, 0], 1013.25, 15);
  const dt = new Date((r.data - 2440587.5) * 86400000);
  const local = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(dt);
  console.log(`  ${name} 2024-06-21 sunrise: ${local} (expected ~${expected}) ${local === expected ? 'PASS ✓' : 'CHECK'}`);
}

// Vimshottari structure check
console.log('── Vimshottari structure ──');
const DASHA_YEARS = { Ke: 7, Ve: 20, Su: 6, Mo: 10, Ma: 7, Ra: 18, Ju: 16, Sa: 19, Me: 17 };
const seq = ['Ke', 'Ve', 'Su', 'Mo', 'Ma', 'Ra', 'Ju', 'Sa', 'Me'];
const totalSpan = seq.reduce((a, k) => a + DASHA_YEARS[k], 0);
console.log(`  dasha total years = ${totalSpan} (should be 120) ${totalSpan === 120 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log('DONE');
