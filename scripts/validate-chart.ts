// End-to-end chart pipeline check against a documented chart.
const { computeChart } = require('../src/lib/astro/chart.ts');

// Mahatma Gandhi — Oct 2, 1869, ~07:12 LMT, Porbandar (21.6417N, 69.6213E)
// Documented: Libra ascendant, Sun in Virgo, Moon in Leo (Purva Phalguni nakshatra)
const gandhi = computeChart({
  name: 'MK Gandhi',
  dob: '1869-10-02',
  tob: '07:12',
  lat: 21.6417,
  lng: 69.6213,
  timezone: 'Asia/Kolkata',
  placeName: 'Porbandar',
});

console.log('Gandhi chart:');
console.log('  Asc:', gandhi.ascendant.signName, gandhi.ascendant.degInSign.toFixed(2), '°, nak', gandhi.ascendant.nakshatra, '(expect Libra)');
console.log('  Sun:', gandhi.sunSign.name, '(expect Virgo)');
console.log('  Moon:', gandhi.moonSign.name, '(expect Leo)');
console.log('  Moon nakshatra:', gandhi.planets.find(p => p.key === 'Mo').nakshatraName, '(expect Purva Phalguni)');
console.log('  Birth tithi:', gandhi.birthPanchang.tithiPaksha, gandhi.birthPanchang.tithiName);
console.log('  Dashas at birth start with:', gandhi.dashas.mahadashas[0].lord, '(expect Ve for P.Phalguni), balance', gandhi.dashas.balanceAtBirth.yearsLeft.toFixed(2), 'yrs');
console.log('  Current dasha (2025):', gandhi.dashaSnapshot?.mahaLord, '/', gandhi.dashaSnapshot?.antarLord);

// Modern chart: 1995-08-15 10:30 IST, New Delhi — structural sanity only
const modern = computeChart({
  name: 'Test', dob: '1995-08-15', tob: '10:30', lat: 28.6139, lng: 77.209, timezone: 'Asia/Kolkata', placeName: 'New Delhi',
});
console.log('\nModern test chart (1995-08-15 10:30 IST Delhi):');
console.log('  Asc:', modern.ascendant.signName, modern.ascendant.degInSign.toFixed(2));
console.log('  Sun:', modern.sunSign.name, '| Moon:', modern.moonSign.name, '| Moon nak:', modern.planets.find(p=>p.key==='Mo').nakshatraName);
console.log('  Current maha dasha:', modern.dashaSnapshot?.mahaLord, 'antar:', modern.dashaSnapshot?.antarLord, 'maha end:', modern.dashaSnapshot?.mahaEnd);
console.log('  Sade sati:', modern.sadeSati.active, modern.sadeSati.phase, '| Saturn now in', modern.sadeSati.saturnSignNow);
console.log('  Mangal dosha severity:', modern.mangalDosha.severity, 'fromAsc:', modern.mangalDosha.fromAsc);
console.log('  D9 (navamsa) asc:', modern.divisionalCharts.D9.ascSign, 'Mo:', modern.divisionalCharts.D9.planets.Mo);
console.log('  SAV:', modern.ashtakavarga.sav.join(','));
console.log('  AV approx?', modern.ashtakavargaApprox);
console.log('  Dasha count:', modern.dashas.mahadashas.length, '| current MD antars:', modern.dashas.current?.maha.antardashas.length);

// Panchang standalone: 2024-01-15 (Makar Sankranti ~Sun enters Capricorn Jan 14/15)
const { panchangFor } = require('../src/lib/astro/panchang.ts');
const { zonedToUTC } = require('../src/lib/tz.ts');
const p = panchangFor(
  zonedToUTC(2024, 1, 15, 12, 0, 'Asia/Kolkata'),
  28.6139, 77.209, 'Asia/Kolkata', '2024-01-15', 1,
);
console.log('\nPanchang 2024-01-15 Delhi:');
console.log('  Sun sign:', p.sunSign.name, '(expect Capricorn around Sankranti)');
console.log('  Tithi:', p.tithi.paksha, p.tithi.name, '| Nakshatra:', p.nakshatra.name);
console.log('  Sunrise:', new Date(p.sunriseISO).toISOString(), '→ local 07:xx IST expected');
const { timeInZone } = require('../src/lib/tz.ts');
console.log('  Sunrise local:', timeInZone('Asia/Kolkata', new Date(p.sunriseISO)), 'Sunset local:', timeInZone('Asia/Kolkata', new Date(p.sunsetISO)));
