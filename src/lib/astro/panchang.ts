// ─── Panchang (almanac) computations ─────────────────────────────────────────

import {
  TITHIS, TITHIS_HI, YOGAS, MOVABLE_KARANAS, NAKSHATRAS, NAKSHATRAS_HI,
  SIGNS, SIGNS_HI, norm360, nakshatraIndex, padaIndex, signIndex, degInSign,
} from './constants';
import { calcPlanet, calcHouses, riseTrans, findCrossing, ayanamsa, juldayFromUTC, utcFromJulday } from './ephemeris';

export interface Choghadiya {
  name: string;
  quality: 'good' | 'medium' | 'bad';
  startISO: string;
  endISO: string;
}

export interface MuhurtaWindow {
  name: string;
  startISO: string;
  endISO: string;
  note: 'auspicious' | 'caution';
}

export interface PanchangResult {
  date: string; // local calendar date at the location
  weekday: number;
  tithi: { index: number; name: string; nameHi: string; paksha: 'Shukla' | 'Krishna'; percent: number; endsAtISO: string | null };
  nakshatra: { index: number; name: string; nameHi: string; pada: number; percent: number; endsAtISO: string | null };
  yoga: { index: number; name: string; percent: number };
  karana: { index: number; name: string };
  moonSign: { index: number; name: string; nameHi: string };
  sunSign: { index: number; name: string; nameHi: string };
  sunriseISO: string | null;
  sunsetISO: string | null;
  moonriseISO: string | null;
  moonsetISO: string | null;
  rahuKaal: { startISO: string | null; endISO: string | null };
  choghadiya: { day: Choghadiya[]; night: Choghadiya[] };
  muhurtas: MuhurtaWindow[]; // Abhijit + Brahma
  ayanamsa: number;
}

function karanaName(tithiIndex0: number, half: number): { name: string; index: number } {
  // tithiIndex0: 0..29 (0 = Shukla Pratipada, 14 = Purnima, 15 = Krishna Pratipada, 29 = Amavasya)
  const k = tithiIndex0 * 2 + half + 1; // 1..60
  if (k === 1) return { name: 'Kimstughna', index: 1 };
  if (k >= 58) return { name: ['Shakuni', 'Chatushpada', 'Naga'][k - 58], index: k };
  const movable = MOVABLE_KARANAS[(k - 2) % 7];
  return { name: movable, index: k };
}

function rahuKaalWindow(weekday: number, sunrise: number, sunset: number): [number, number] {
  // 8 parts of the day; Rahu kaal part by weekday (0=Sunday)
  const partsByDay = [8, 2, 7, 5, 6, 4, 3];
  const part = partsByDay[weekday];
  const len = (sunset - sunrise) / 8;
  return [sunrise + (part - 1) * len, sunrise + part * len];
}

// ── Choghadiya ───────────────────────────────────────────────────────────────
// Cycle of 7, repeated to fill 8 slots. Weekday start offsets (classical).
const CHOGH_NAMES = ['Udveg', 'Char', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog'] as const;
const CHOGH_QUALITY: Record<(typeof CHOGH_NAMES)[number], 'good' | 'medium' | 'bad'> = {
  Amrit: 'good', Shubh: 'good', Labh: 'good', Char: 'medium', Udveg: 'bad', Kaal: 'bad', Rog: 'bad',
};
const CHOGH_DAY_START = [0, 3, 5, 2, 4, 1, 6]; // Sun..Sat → index into CHOGH_NAMES
const CHOGH_NIGHT_START = [3, 1, 4, 0, 2, 5, 2]; // Sun..Sat

function choghadiyaSlots(
  startJD: number,
  endJD: number,
  weekday: number,
  isNight: boolean,
): Choghadiya[] {
  const len = (endJD - startJD) / 8;
  const startIdx = isNight ? CHOGH_NIGHT_START[weekday] : CHOGH_DAY_START[weekday];
  const out: Choghadiya[] = [];
  for (let i = 0; i < 8; i++) {
    const name = CHOGH_NAMES[(startIdx + i) % 7];
    out.push({
      name,
      quality: CHOGH_QUALITY[name],
      startISO: utcFromJulday(startJD + i * len).toISOString(),
      endISO: utcFromJulday(startJD + (i + 1) * len).toISOString(),
    });
  }
  return out;
}

export function panchangFor(
  dateUTC: Date,
  lat: number,
  lng: number,
  timeZone: string,
  localDate: string,
  weekday: number,
): PanchangResult {
  const jd = juldayFromUTC(dateUTC);
  const sun = calcPlanet('Su', jd, false);
  const moon = calcPlanet('Mo', jd, false);
  const sunT = sun.lon;
  const moonT = moon.lon;

  // Tithi
  const elong = norm360(moonT - sunT);
  const tithiIdx0 = Math.floor(elong / 12);
  const tithiFrac = (elong % 12) / 12;
  const paksha: 'Shukla' | 'Krishna' = tithiIdx0 < 15 ? 'Shukla' : 'Krishna';
  const nameIdx = tithiIdx0 % 15;
  const tName = paksha === 'Krishna' && nameIdx === 14 ? 'Amavasya' : TITHIS[nameIdx];
  const tNameHi = paksha === 'Krishna' && nameIdx === 14 ? 'अमावस्या' : TITHIS_HI[nameIdx];

  // Nakshatra (sidereal Moon)
  const moonS = norm360(moonT - ayanamsa(jd));
  const nakIdx = nakshatraIndex(moonS);
  const nakFrac = (moonS % (360 / 27)) / (360 / 27);

  // Yoga: sun+moon / 13°20' (uses tropical sum — same result as sidereal since ayanamsa cancels mod 360/27? No — it doesn't cancel. Classical yoga uses sidereal longitudes.)
  const sunS = norm360(sunT - ayanamsa(jd));
  const yogaLon = norm360(sunS + moonS);
  const yogaIdx = Math.floor(yogaLon / (360 / 27));
  const yogaFrac = (yogaLon % (360 / 27)) / (360 / 27);

  // Karana
  const halfIdx = Math.floor(elong / 6);
  const karana = karanaName(tithiIdx0, halfIdx % 2);

  // Sunrise / sunset / moonrise / moonset (search from local midnight UTC-ish)
  const jdMidnight = jd - 0.6; // start search a bit before to catch same-day events
  const sr = riseTrans(jdMidnight, 'Su', true, lat, lng);
  const ss = riseTrans(jdMidnight, 'Su', false, lat, lng);
  const mr = riseTrans(jdMidnight, 'Mo', true, lat, lng);
  const ms = riseTrans(jdMidnight, 'Mo', false, lat, lng);

  // Choghadiya + muhurtas (need sunrise/sunset + next sunrise for the night slots)
  let choghadiya: { day: Choghadiya[]; night: Choghadiya[] } = { day: [], night: [] };
  const muhurtas: MuhurtaWindow[] = [];
  if (sr && ss) {
    const nextSr = riseTrans(ss - 0.05, 'Su', true, lat, lng) ?? ss + 1;
    choghadiya = {
      day: choghadiyaSlots(sr, ss, weekday, false),
      night: choghadiyaSlots(ss, nextSr, weekday, true),
    };
    // Abhijit muhurta: 8th of 15 day muhurtas (local noon ± ~24 min)
    const dayLen = ss - sr;
    const abhStart = sr + (dayLen / 15) * 7;
    const abhEnd = sr + (dayLen / 15) * 8;
    muhurtas.push({
      name: 'Abhijit',
      startISO: utcFromJulday(abhStart).toISOString(),
      endISO: utcFromJulday(abhEnd).toISOString(),
      note: 'auspicious',
    });
    // Brahma muhurta: 96→48 min before sunrise
    muhurtas.push({
      name: 'Brahma',
      startISO: utcFromJulday(sr - 96 / 1440).toISOString(),
      endISO: utcFromJulday(sr - 48 / 1440).toISOString(),
      note: 'auspicious',
    });
  }

  // Rahu kaal from sunrise/sunset
  let rahuStartISO: string | null = null;
  let rahuEndISO: string | null = null;
  if (sr && ss) {
    const [rs, re] = rahuKaalWindow(weekday, sr, ss);
    rahuStartISO = utcFromJulday(rs).toISOString();
    rahuEndISO = utcFromJulday(re).toISOString();
  }

  // End times: tithi ends when elongation reaches next multiple of 12
  const tithiEndJD = findCrossing(
    (j) => {
      const su = calcPlanet('Su', j, false).lon;
      const mo = calcPlanet('Mo', j, false).lon;
      return norm360(mo - su);
    },
    (tithiIdx0 + 1) * 12,
    jd,
    2.2,
  );
  const nakEndJD = findCrossing((j) => calcPlanet('Mo', j, true).lon, (nakIdx + 1) * (360 / 27), jd, 1.5);

  return {
    date: localDate,
    weekday,
    tithi: {
      index: tithiIdx0 + 1,
      name: tName,
      nameHi: tNameHi,
      paksha,
      percent: Math.round(tithiFrac * 100),
      endsAtISO: tithiEndJD ? utcFromJulday(tithiEndJD).toISOString() : null,
    },
    nakshatra: {
      index: nakIdx,
      name: NAKSHATRAS[nakIdx],
      nameHi: NAKSHATRAS_HI[nakIdx],
      pada: padaIndex(moonS),
      percent: Math.round(nakFrac * 100),
      endsAtISO: nakEndJD ? utcFromJulday(nakEndJD).toISOString() : null,
    },
    yoga: { index: yogaIdx + 1, name: YOGAS[yogaIdx], percent: Math.round(yogaFrac * 100) },
    karana,
    moonSign: {
      index: signIndex(moonS),
      name: SIGNS[signIndex(moonS)],
      nameHi: SIGNS_HI[signIndex(moonS)],
    },
    sunSign: {
      index: signIndex(sunS),
      name: SIGNS[signIndex(sunS)],
      nameHi: SIGNS_HI[signIndex(sunS)],
    },
    sunriseISO: sr ? utcFromJulday(sr).toISOString() : null,
    sunsetISO: ss ? utcFromJulday(ss).toISOString() : null,
    moonriseISO: mr ? utcFromJulday(mr).toISOString() : null,
    moonsetISO: ms ? utcFromJulday(ms).toISOString() : null,
    rahuKaal: { startISO: rahuStartISO, endISO: rahuEndISO },
    choghadiya,
    muhurtas,
    ayanamsa: ayanamsa(jd),
  };
}

// ── Month scan (lightweight) ─────────────────────────────────────────────────
// Only tithi + nakshatra + sunrise per day — no rise-of-moon, choghadiya or
// end-time crossings — so a whole month costs ~30 cheap ephemeris reads.

export interface DaySummary {
  date: string; // local YYYY-MM-DD
  weekday: number;
  tithi: { index: number; name: string; nameHi: string; paksha: 'Shukla' | 'Krishna' };
  nakshatra: { name: string; nameHi: string };
  sunriseISO: string | null;
  /** 'purnima' | 'amavasya' | 'ekadashi' when the day carries a classical marker */
  special: 'purnima' | 'amavasya' | 'ekadashi' | null;
}

export function daySummaryFor(dateUTC: Date, localDate: string, weekday: number, lat: number, lng: number): DaySummary {
  const jd = juldayFromUTC(dateUTC);
  const sun = calcPlanet('Su', jd, false);
  const moon = calcPlanet('Mo', jd, false);

  const elong = norm360(moon.lon - sun.lon);
  const tithiIdx0 = Math.floor(elong / 12);
  const paksha: 'Shukla' | 'Krishna' = tithiIdx0 < 15 ? 'Shukla' : 'Krishna';
  const nameIdx = tithiIdx0 % 15;
  const tName = paksha === 'Krishna' && nameIdx === 14 ? 'Amavasya' : TITHIS[nameIdx];
  const tNameHi = paksha === 'Krishna' && nameIdx === 14 ? 'अमावस्या' : TITHIS_HI[nameIdx];

  const moonS = norm360(moon.lon - ayanamsa(jd));
  const nakIdx = nakshatraIndex(moonS);

  const sr = riseTrans(jd - 0.6, 'Su', true, lat, lng);

  // Classical day markers: Purnima (Shukla 15), Amavasya (Krishna 15), Ekadashi (11th tithi, either paksha)
  const special: DaySummary['special'] =
    paksha === 'Krishna' && nameIdx === 14
      ? 'amavasya'
      : nameIdx === 14
        ? 'purnima'
        : nameIdx === 10
          ? 'ekadashi'
          : null;

  return {
    date: localDate,
    weekday,
    tithi: { index: tithiIdx0 + 1, name: tName, nameHi: tNameHi, paksha },
    nakshatra: { name: NAKSHATRAS[nakIdx], nameHi: NAKSHATRAS_HI[nakIdx] },
    sunriseISO: sr ? utcFromJulday(sr).toISOString() : null,
    special,
  };
}
