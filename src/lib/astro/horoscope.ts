// ─── Gochara (transits) & horoscope structure ───────────────────────────────
// Returns structured data; the client renders localized sentences.

import { SIGNS, PlanetKey, nakshatraIndex, NAKSHATRAS } from './constants';
import { calcAllPlanets, calcPlanet, juldayFromUTC } from './ephemeris';

// Classical benefic houses counted from natal Moon (Janma rashi)
export const GOCHARA_BENEFIC: Record<PlanetKey, number[]> = {
  Su: [3, 6, 10, 11],
  Mo: [1, 3, 6, 7, 10, 11],
  Ma: [3, 6, 11],
  Me: [2, 4, 6, 8, 10, 11],
  Ju: [2, 5, 7, 9, 11],
  Ve: [1, 2, 3, 4, 5, 8, 9, 11, 12],
  Sa: [3, 6, 11],
  Ra: [3, 6, 10, 11],
  Ke: [3, 6, 11],
};

export const SLOW_PLANETS: PlanetKey[] = ['Sa', 'Ju', 'Ra'];

export interface TransitRow {
  key: PlanetKey;
  houseFromMoon: number; // 1-12
  benefic: boolean;
  note: 'support' | 'mixed' | 'pressure';
}

export interface HoroscopeResult {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  referenceDate: string;
  moonSign: number; // natal
  score: number; // 0-100
  transits: TransitRow[];
  highlights: PlanetKey[];
  cautions: PlanetKey[];
  dashaNote: string; // "Su mahadasha, Ve antardasha"
  headlineKey: 'excellent' | 'good' | 'steady' | 'demanding';
}

export function gocharaAt(
  when: Date,
  natalMoonLon: number,
  dashaNote: string,
): { score: number; transits: TransitRow[]; highlights: PlanetKey[]; cautions: PlanetKey[] } {
  const jd = juldayFromUTC(when);
  const planets = calcAllPlanets(jd, true);
  const natalSign = Math.floor(natalMoonLon / 30);
  const rows: TransitRow[] = [];
  let favorableW = 0;
  let totalW = 0;

  for (const key of ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra'] as PlanetKey[]) {
    const sign = Math.floor(planets[key].lon / 30);
    const house = ((sign - natalSign) % 12 + 12) % 12 + 1;
    const benefic = GOCHARA_BENEFIC[key].includes(house);
    const weight = SLOW_PLANETS.includes(key) ? 2 : 1;
    totalW += weight;
    if (benefic) favorableW += weight;
    rows.push({
      key,
      houseFromMoon: house,
      benefic,
      note: benefic ? 'support' : SLOW_PLANETS.includes(key) ? 'pressure' : 'mixed',
    });
  }

  const score = Math.round((favorableW / Math.max(1, totalW)) * 100);
  const highlights = rows.filter((r) => r.benefic && ['Ju', 'Ve', 'Me', 'Mo'].includes(r.key)).map((r) => r.key);
  const cautions = rows.filter((r) => !r.benefic && ['Sa', 'Ma', 'Ra'].includes(r.key)).map((r) => r.key);
  return { score, transits: rows, highlights, cautions };
}

export function horoscope(
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  referenceDate: Date,
  natalMoonLon: number,
  dashaNote: string,
): HoroscopeResult {
  let when = referenceDate;
  if (period === 'weekly') when = new Date(referenceDate.getTime() + 1.5 * 86400000);
  if (period === 'monthly') when = new Date(referenceDate.getTime() + 12 * 86400000);
  if (period === 'yearly') when = new Date(referenceDate.getTime() + 90 * 86400000);

  const g = gocharaAt(when, natalMoonLon, dashaNote);
  const headlineKey = g.score >= 72 ? 'excellent' : g.score >= 55 ? 'good' : g.score >= 42 ? 'steady' : 'demanding';
  return {
    period,
    referenceDate: referenceDate.toISOString().slice(0, 10),
    moonSign: Math.floor(natalMoonLon / 30),
    score: g.score,
    transits: g.transits,
    highlights: g.highlights,
    cautions: g.cautions,
    dashaNote,
    headlineKey,
  };
}

/** Current Moon nakshatra name (for decision-timing context). */
export function moonNakshatraNow(date: Date): { index: number; name: string } {
  const p = calcPlanet('Mo', juldayFromUTC(date), true);
  const idx = nakshatraIndex(p.lon);
  return { index: idx, name: NAKSHATRAS[idx] };
}

export const signNameOf = (i: number) => SIGNS[((i % 12) + 12) % 12];
