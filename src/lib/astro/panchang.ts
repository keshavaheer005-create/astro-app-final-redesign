// ─── Panchang (almanac) computations ─────────────────────────────────────────

import {
  TITHIS, TITHIS_HI, YOGAS, MOVABLE_KARANAS, NAKSHATRAS, NAKSHATRAS_HI,
  SIGNS, SIGNS_HI, norm360, nakshatraIndex, padaIndex, signIndex, degInSign,
} from './constants';
import { calcPlanet, calcHouses, riseTrans, findCrossing, ayanamsa, juldayFromUTC, utcFromJulday } from './ephemeris';

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
    ayanamsa: ayanamsa(jd),
  };
}
