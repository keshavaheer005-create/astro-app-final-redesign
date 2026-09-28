// ─── Full birth-chart computation ────────────────────────────────────────────

import {
  SIGNS, SIGNS_HI, NAKSHATRAS, NAKSHATRAS_HI, PLANETS, SIGN_LORDS,
  nakshatraIndex, padaIndex, signIndex, degInSign, PlanetKey, PLANET_ORDER,
} from './constants';
import { calcAllPlanets, calcHouses, ayanamsa, juldayFromUTC, PlanetPos } from './ephemeris';
import { vimshottariDasha, dashaSnapshot } from './dasha';
import { buildVargas, VARGA_LIST } from './varga';
import { ashtakavarga, isFallbackTables } from './ashtakavarga';
import { mangalDosha, sadeSati } from './doshas';
import { panchangFor } from './panchang';
import { zonedToUTC, ymdInZone, weekdayInZone } from '@/lib/tz';

export interface BirthInput {
  name: string;
  dob: string; // YYYY-MM-DD
  tob: string; // HH:MM (24h)
  lat: number;
  lng: number;
  timezone: string;
  placeName?: string;
}

export interface PlanetPlacement {
  key: PlanetKey;
  lon: number; // sidereal
  lonTropical: number;
  sign: number;
  signName: string;
  degInSign: number;
  house: number; // whole-sign from Asc
  nakshatra: number;
  nakshatraName: string;
  pada: number;
  retrograde: boolean;
  speed: number;
}

export interface ComputedChart {
  input: BirthInput & { utcISO: string };
  ayanamsa: number;
  ascendant: { lon: number; sign: number; signName: string; signNameHi: string; nakshatra: string; nakshatraHi: string; pada: number; degInSign: number };
  mc: { lon: number };
  moonSign: { index: number; name: string; nameHi: string };
  sunSign: { index: number; name: string; nameHi: string };
  planets: PlanetPlacement[];
  houses: { index: number; sign: number; signName: string; lord: PlanetKey }[];
  dashas: ReturnType<typeof vimshottariDasha>;
  dashaSnapshot: ReturnType<typeof dashaSnapshot>;
  divisionalCharts: ReturnType<typeof buildVargas>;
  ashtakavarga: ReturnType<typeof ashtakavarga>;
  ashtakavargaApprox: boolean;
  mangalDosha: ReturnType<typeof mangalDosha>;
  sadeSati: ReturnType<typeof sadeSati>;
  birthPanchang: { tithiName: string; tithiPaksha: string; nakshatraName: string; yogaName: string; karanaName: string };
}

export function computeChart(input: BirthInput): ComputedChart {
  const [y, m, d] = input.dob.split('-').map(Number);
  const [hh, mm] = input.tob.split(':').map(Number);
  const utc = zonedToUTC(y, m, d, hh || 0, mm || 0, input.timezone);
  const jd = juldayFromUTC(utc);

  const ay = ayanamsa(jd);
  const houses = calcHouses(jd, input.lat, input.lng);
  const planetsTropical = calcAllPlanets(jd, false);

  const planetLons = {} as Record<PlanetKey, { lon: number }>;
  const planets: PlanetPlacement[] = [];
  const ascSign = signIndex(houses.ascSidereal);

  for (const key of PLANET_ORDER) {
    const t = planetsTropical[key];
    const lon = ((t.lon - ay) % 360 + 360) % 360;
    planetLons[key] = { lon };
    const si = signIndex(lon);
    const nak = nakshatraIndex(lon);
    planets.push({
      key,
      lon,
      lonTropical: t.lon,
      sign: si,
      signName: SIGNS[si],
      degInSign: degInSign(lon),
      house: ((si - ascSign) % 12 + 12) % 12 + 1,
      nakshatra: nak,
      nakshatraName: NAKSHATRAS[nak],
      pada: padaIndex(lon),
      retrograde: t.retrograde,
      speed: t.speed,
    });
  }

  const ascNak = nakshatraIndex(houses.ascSidereal);
  const moonSignIdx = signIndex(planetLons.Mo.lon);
  const sunSignIdx = signIndex(planetLons.Su.lon);

  const houseList = Array.from({ length: 12 }, (_, i) => {
    const sign = (ascSign + i) % 12;
    return { index: i + 1, sign, signName: SIGNS[sign], lord: SIGN_LORDS[sign] as PlanetKey };
  });

  const dashas = vimshottariDasha(planetLons.Mo.lon, utc);
  const vargas = buildVargas(houses.ascSidereal, planetLons);
  const akv = ashtakavarga(planetLons, houses.ascSidereal);

  const doshaInput = Object.fromEntries(
    PLANET_ORDER.map((k) => {
      const p = planets.find((x) => x.key === k)!;
      return [k, { lon: p.lon, house: p.house, sign: p.sign }];
    }),
  ) as Record<PlanetKey, { lon: number; house: number; sign: number }>;

  const localDate = ymdInZone(input.timezone, utc);
  const weekday = weekdayInZone(input.timezone, utc);
  const bp = panchangFor(utc, input.lat, input.lng, input.timezone, localDate, weekday);

  return {
    input: { ...input, utcISO: utc.toISOString() },
    ayanamsa: ay,
    ascendant: {
      lon: houses.ascSidereal,
      sign: ascSign,
      signName: SIGNS[ascSign],
      signNameHi: SIGNS_HI[ascSign],
      nakshatra: NAKSHATRAS[ascNak],
      nakshatraHi: NAKSHATRAS_HI[ascNak],
      pada: padaIndex(houses.ascSidereal),
      degInSign: degInSign(houses.ascSidereal),
    },
    mc: { lon: houses.mcSidereal },
    moonSign: { index: moonSignIdx, name: SIGNS[moonSignIdx], nameHi: SIGNS_HI[moonSignIdx] },
    sunSign: { index: sunSignIdx, name: SIGNS[sunSignIdx], nameHi: SIGNS_HI[sunSignIdx] },
    planets,
    houses: houseList,
    dashas,
    dashaSnapshot: dashaSnapshot(dashas),
    divisionalCharts: vargas,
    ashtakavarga: akv,
    ashtakavargaApprox: isFallbackTables(),
    mangalDosha: mangalDosha(doshaInput, houses.ascSidereal),
    sadeSati: sadeSati(planetLons.Mo.lon, new Date()),
    birthPanchang: {
      tithiName: bp.tithi.name,
      tithiPaksha: bp.tithi.paksha,
      nakshatraName: bp.nakshatra.name,
      yogaName: bp.yoga.name,
      karanaName: bp.karana.name,
    },
  };
}

/** Compact chart context for the Acharya LLM prompt. */
export function compactChartContext(chart: ComputedChart): string {
  const lines: string[] = [];
  lines.push(`Name: ${chart.input.name}; Born ${chart.input.dob} ${chart.input.tob} (${chart.input.timezone})`);
  lines.push(`Ascendant: ${chart.ascendant.signName} ${chart.ascendant.degInSign.toFixed(1)}°, nakshatra ${chart.ascendant.nakshatra}`);
  lines.push(`Moon sign: ${chart.moonSign.name}; Sun sign (sidereal): ${chart.sunSign.name}`);
  for (const p of chart.planets) {
    lines.push(`${p.key}: ${p.signName} ${p.degInSign.toFixed(1)}°, house ${p.house}, nakshatra ${p.nakshatraName}${p.retrograde ? ' (R)' : ''}`);
  }
  if (chart.dashaSnapshot) {
    lines.push(`Current Vimshottari dasha: ${chart.dashaSnapshot.mahaLord} mahadasha (until ${chart.dashaSnapshot.mahaEnd}), ${chart.dashaSnapshot.antarLord ?? ''} antardasha (until ${chart.dashaSnapshot.antarEnd ?? ''})`);
  }
  lines.push(`Mangal dosha: ${chart.mangalDosha.severity}; Sade sati: ${chart.sadeSati.active ? `active (${chart.sadeSati.phase})` : 'not active'}`);
  const sav = chart.ashtakavarga.sav;
  lines.push(`Sarvashtakavarga of key signs: ascendant ${sav[chart.ascendant.sign]}, moon ${sav[chart.moonSign.index]}, 10th house sign ${sav[(chart.ascendant.sign + 9) % 12]}`);
  lines.push(transitStrengthLine(chart));
  return lines.join('\n');
}

/**
 * Gochara quality from the natal Sarvashtakavarga: for the slowly moving
 * grahas (Saturn, Jupiter, Rahu — plus the Sun as a fast reference), report
 * the SAV bindus of the sign each planet CURRENTLY transits. Classical
 * SAV gochara rule: a sign with 29+ bindus supports any planet's transit,
 * 25-28 is average, below 25 strains the planet's significations.
 */
export function transitStrengthLine(chart: ComputedChart, when: Date = new Date()): string {
  try {
    const jd = juldayFromUTC(when);
    const transit = calcAllPlanets(jd, true);
    const sav = chart.ashtakavarga.sav;
    const label = (b: number) => (b >= 29 ? 'supportive' : b >= 25 ? 'neutral' : 'demanding');
    const parts = (['Sa', 'Ju', 'Ra', 'Su'] as PlanetKey[]).map((k) => {
      const sign = Math.floor(transit[k].lon / 30) % 12;
      const b = sav[sign];
      return `${k} transits ${SIGNS[sign]}: ${b} bindus (${label(b)})`;
    });
    return `Transit strength (natal SAV at current transit sign): ${parts.join('; ')}.`;
  } catch {
    return '';
  }
}
