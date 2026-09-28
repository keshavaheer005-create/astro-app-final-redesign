// Quick validation of sweph (Swiss Ephemeris) under bun
const swe = require('sweph');
const C = swe.constants;

console.log('version:', swe.version());

swe.set_ephe_path('/tmp/eph');
const jd = swe.julday(2000, 1, 1, 12.0, C.SE_GREG_CAL);
console.log('JD:', jd);

const flags = C.SEFLG_SPEED | C.SEFLG_MOSEPH;
const sun = swe.calc_ut(jd, C.SE_SUN, flags);
const moon = swe.calc_ut(jd, C.SE_MOON, flags);
const saturn = swe.calc_ut(jd, C.SE_SATURN, flags);
console.log('Sun tropical lon:', sun[0], 'speed:', sun[3]);
console.log('Moon tropical lon:', moon[0], 'speed:', moon[3]);
console.log('Saturn tropical lon:', saturn[0], 'speed:', saturn[3]);

swe.set_sid_mode(C.SE_SIDM_LAHIRI, 0, 0);
const sunSid = swe.calc_ut(jd, C.SE_SUN, flags | C.SEFLG_SIDEREAL);
console.log('Sun sidereal (Lahiri):', sunSid[0]);
console.log('Ayanamsa:', swe.get_ayanamsa_ut(jd));

const houses = swe.houses(jd, 51.5072, -0.1276, 'W');
console.log('Asc tropical:', houses.ascendant, 'MC:', houses.mc);

const rise = swe.rise_trans(jd, C.SE_SUN, C.SE_CALC_RISE, [77.21, 28.61, 0]);
console.log('Sunrise Delhi:', JSON.stringify(rise).slice(0, 300));

const node = swe.calc_ut(jd, C.SE_TRUE_NODE, flags | C.SEFLG_SIDEREAL);
console.log('True node sidereal:', node.longitude, 'speed:', node.longitudeSpeed);
