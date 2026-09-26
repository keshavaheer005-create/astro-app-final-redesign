// ─── Swiss Ephemeris wrapper (sweph) ─────────────────────────────────────────
// Real Swiss Ephemeris (sweph NAPI/WASM build). Uses SEFLG_MOSEPH (Moshier
// analytical ephemeris) so no data files are needed — precision well below
// 0.1 arcsec for our range. Sidereal mode: Lahiri (Chitrapaksha).

import type { PlanetKey } from './constants';

let swe: any = null;
const C: any = new Proxy({}, { get: () => undefined });

function loadSwe() {
  if (swe) return swe;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  swe = require('sweph');
  const c = swe.constants;
  Object.assign(C, c);
  swe.set_ephe_path(process.env.SWEPH_PATH || '/tmp/selfsage-eph');
  // Lahiri / Chitrapaksha ayanamsa
  swe.set_sid_mode(c.SE_SIDM_LAHIRI, 0, 0);
  return swe;
}

export const FLAGS_TROPICAL = () => {
  const s = loadSwe();
  return s.constants.SEFLG_SPEED | s.constants.SEFLG_MOSEPH;
};

export const FLAGS_SIDEREAL = () => {
  const s = loadSwe();
  return s.constants.SEFLG_SPEED | s.constants.SEFLG_MOSEPH | s.constants.SEFLG_SIDEREAL;
};

/** Gregorian date+UTChh:mm(+ss float) → Julian Day (UT) */
export function juldayFromUTC(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function utcFromJulday(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

export interface PlanetPos {
  lon: number; // sidereal longitude unless tropical context
  lat: number;
  dist: number;
  speed: number; // deg/day
  retrograde: boolean;
}

const SWE_IDS: Record<PlanetKey, string> = {
  Su: 'SE_SUN', Mo: 'SE_MOON', Ma: 'SE_MARS', Me: 'SE_MERCURY',
  Ju: 'SE_JUPITER', Ve: 'SE_VENUS', Sa: 'SE_SATURN', Ra: 'SE_TRUE_NODE', Ke: 'SE_TRUE_NODE',
};

export function calcPlanet(planet: PlanetKey, jdUT: number, sidereal = true): PlanetPos {
  const s = loadSwe();
  const id = s.constants[SWE_IDS[planet]];
  const flags = sidereal ? FLAGS_SIDEREAL() : FLAGS_TROPICAL();
  const res = s.calc_ut(jdUT, id, flags);
  if (res.error) throw new Error(`sweph calc_ut error: ${res.error}`);
  const [lon, lat, dist, speed] = res.data as number[];
  let lonOut = lon;
  if (planet === 'Ke') lonOut = (lon + 180) % 360;
  return {
    lon: ((lonOut % 360) + 360) % 360,
    lat,
    dist,
    speed: planet === 'Ke' ? -speed : speed,
    retrograde: (planet === 'Ke' ? true : speed < 0),
  };
}

export function calcAllPlanets(jdUT: number, sidereal = true): Record<PlanetKey, PlanetPos> {
  const out = {} as Record<PlanetKey, PlanetPos>;
  for (const p of ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra'] as PlanetKey[]) {
    out[p] = calcPlanet(p, jdUT, sidereal);
  }
  out.Ke = calcPlanet('Ke', jdUT, sidereal);
  return out;
}

export function ayanamsa(jdUT: number): number {
  const s = loadSwe();
  return s.get_ayanamsa_ut(jdUT);
}

export interface HousesInfo {
  ascTropical: number;
  mcTropical: number;
  ascSidereal: number;
  mcSidereal: number;
}

export function calcHouses(jdUT: number, lat: number, lng: number): HousesInfo {
  const s = loadSwe();
  const res = s.houses(jdUT, lat, lng, 'W');
  if (!res?.data) throw new Error('sweph houses error');
  const ascTropical = res.data.points[0] as number;
  const mcTropical = res.data.points[1] as number;
  const ay = ayanamsa(jdUT);
  return {
    ascTropical,
    mcTropical,
    ascSidereal: ((ascTropical - ay) % 360 + 360) % 360,
    mcSidereal: ((mcTropical - ay) % 360 + 360) % 360,
  };
}

/** Rise/set event. rsmi: use constants SE_CALC_RISE (1) / SE_CALC_SET (2). */
export function riseTrans(
  jdStartUT: number,
  planet: 'Su' | 'Mo',
  rise: boolean,
  lat: number,
  lng: number,
): number | null {
  const s = loadSwe();
  const c = s.constants;
  const id = planet === 'Su' ? c.SE_SUN : c.SE_MOON;
  const rsmi = rise ? c.SE_CALC_RISE : c.SE_CALC_SET;
  const res = s.rise_trans(jdStartUT, id, '', c.SEFLG_MOSEPH, rsmi, [lng, lat, 0], 1013.25, 15);
  if (res.error) return null;
  return res.data as number;
}

/** Find the next moment when fn(jd) crosses the target value going upward
 *  (fn must be monotonic-ish locally). Uses coarse scan + bisection. */
export function findCrossing(
  fn: (jd: number) => number,
  target: number,
  jdStart: number,
  maxDays: number,
  stepDays = 0.05,
): number | null {
  const n = (x: number) => ((x % 360) + 360) % 360;
  let prev = fn(jdStart);
  let prevDelta = ((n(target - prev) + 180) % 360) - 180; // signed diff target - fn
  for (let jd = jdStart + stepDays; jd <= jdStart + maxDays; jd += stepDays) {
    const cur = fn(jd);
    const curDelta = ((n(target - cur) + 180) % 360) - 180;
    if (prevDelta > 0 && curDelta <= 0 && Math.abs(curDelta - prevDelta) < 180) {
      // crossed downward past target
      let lo = jd - stepDays;
      let hi = jd;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        const d = ((n(target - fn(mid)) + 180) % 360) - 180;
        if (d > 0) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    }
    prev = cur;
    prevDelta = curDelta;
  }
  return null;
}

export const SWE_OK = () => {
  try {
    loadSwe();
    return true;
  } catch {
    return false;
  }
};
