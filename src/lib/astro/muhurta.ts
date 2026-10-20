// ─── Muhurta building blocks (daily timing windows) ─────────────────────────
//
// Everything here is classical, well-attested material that Indian almanacs
// agree on: weekday-lord Horas in Chaldean order, Rahu / Yamaganda / Gulika
// eighths, Abhijit & Vijaya (8th and 11th of the 15 day-muhurtas), Sarvartha &
// Amrit Siddhi yogas, Bhadra (Vishti karana), Panchak, and the personal
// Tara-bala / Chandra-bala.
//
// DELIBERATELY NOT INCLUDED: Dur Muhurta and Varjyam. Published tables for
// those disagree with each other, and showing a wrong "avoid" window is worse
// than showing none.

import { calcPlanet, findCrossing, utcFromJulday } from './ephemeris';
import { NAKSHATRAS, NAKSHATRAS_HI, norm360 } from './constants';

const iso = (jd: number) => utcFromJulday(jd).toISOString();
const NAK_SPAN = 360 / 27;

export type Quality = 'good' | 'medium' | 'bad';

/* ── Hora (planetary hours) ──────────────────────────────────────────────── */

export const HORA_ORDER = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'] as const;
export type HoraPlanet = (typeof HORA_ORDER)[number];
// weekday (0 = Sunday) → its lord's position in HORA_ORDER
const WEEKDAY_LORD_IDX = [0, 3, 6, 2, 5, 1, 4];
const HORA_QUALITY: Record<HoraPlanet, Quality> = {
  Jupiter: 'good', Venus: 'good', Mercury: 'good', Moon: 'medium', Sun: 'medium', Mars: 'bad', Saturn: 'bad',
};

export interface HoraSlot {
  planet: HoraPlanet;
  part: 'day' | 'night';
  quality: Quality;
  startISO: string;
  endISO: string;
}

/** 24 unequal hours: 12 between sunrise and sunset, 12 between sunset and next sunrise. */
export function horaSlots(srJD: number, ssJD: number, nextSrJD: number, weekday: number): HoraSlot[] {
  const out: HoraSlot[] = [];
  const dayLen = (ssJD - srJD) / 12;
  const nightLen = (nextSrJD - ssJD) / 12;
  for (let h = 0; h < 24; h++) {
    const planet = HORA_ORDER[(WEEKDAY_LORD_IDX[weekday] + h) % 7];
    const day = h < 12;
    const start = day ? srJD + h * dayLen : ssJD + (h - 12) * nightLen;
    const end = day ? start + dayLen : start + nightLen;
    out.push({ planet, part: day ? 'day' : 'night', quality: HORA_QUALITY[planet], startISO: iso(start), endISO: iso(end) });
  }
  return out;
}

/* ── Eighths of the day: Rahu Kaal, Yamaganda, Gulika ────────────────────── */

const RAHU_PART = [8, 2, 7, 5, 6, 4, 3];
const YAMA_PART = [5, 4, 3, 2, 1, 7, 6];
const GULIKA_PART = [7, 6, 5, 4, 3, 2, 1];

export type JDWindow = [number, number];

function eighth(srJD: number, ssJD: number, part: number): JDWindow {
  const len = (ssJD - srJD) / 8;
  return [srJD + (part - 1) * len, srJD + part * len];
}

export interface DayJDWindows {
  rahu: JDWindow;
  yamaganda: JDWindow;
  gulika: JDWindow;
  abhijit: JDWindow;
  vijaya: JDWindow;
}

export function dayWindows(srJD: number, ssJD: number, weekday: number): DayJDWindows {
  const m = (ssJD - srJD) / 15; // one day-muhurta
  return {
    rahu: eighth(srJD, ssJD, RAHU_PART[weekday]),
    yamaganda: eighth(srJD, ssJD, YAMA_PART[weekday]),
    gulika: eighth(srJD, ssJD, GULIKA_PART[weekday]),
    abhijit: [srJD + 7 * m, srJD + 8 * m], // 8th muhurta
    vijaya: [srJD + 10 * m, srJD + 11 * m], // 11th muhurta
  };
}

export const inWindow = (jd: number, w: JDWindow) => jd >= w[0] && jd < w[1];

/* ── Siddhi yogas (weekday × nakshatra) ──────────────────────────────────── */
// Only pairs that independent almanacs agree on are included.

const nk = (...names: string[]): number[] =>
  names.map((n) => {
    const i = (NAKSHATRAS as readonly string[]).indexOf(n);
    if (i < 0) throw new Error(`unknown nakshatra ${n}`);
    return i;
  });

/** weekday (0 = Sunday) → nakshatras that form Sarvartha Siddhi Yoga */
const SARVARTHA: number[][] = [
  nk('Hasta', 'Pushya', 'Uttara Phalguni', 'Uttara Ashadha', 'Uttara Bhadrapada', 'Mula', 'Ashlesha'),
  nk('Rohini', 'Mrigashira', 'Pushya', 'Anuradha', 'Shravana'),
  nk('Ashwini', 'Krittika'),
  nk('Rohini', 'Mrigashira', 'Hasta', 'Anuradha', 'Krittika'),
  nk('Ashwini', 'Punarvasu', 'Pushya', 'Anuradha', 'Revati'),
  nk('Ashwini', 'Punarvasu', 'Anuradha', 'Shravana', 'Revati'),
  nk('Rohini', 'Swati', 'Shravana'),
];
/** weekday → the single nakshatra that forms Amrit Siddhi Yoga */
const AMRIT: number[] = nk('Hasta', 'Mrigashira', 'Ashwini', 'Anuradha', 'Pushya', 'Revati', 'Rohini');

export interface SiddhiWindow {
  kind: 'sarvartha' | 'amrit';
  nakshatra: string;
  nakshatraHi: string;
  startISO: string;
  endISO: string;
}

const moonSid = (jd: number) => calcPlanet('Mo', jd, true).lon;

/** Siddhi yogas active between two instants (a panchang day: sunrise → next sunrise). */
export function siddhiYogas(weekday: number, fromJD: number, toJD: number): SiddhiWindow[] {
  const out: SiddhiWindow[] = [];
  let jd = fromJD;
  for (let guard = 0; guard < 4 && jd < toJD; guard++) {
    const idx = Math.floor(norm360(moonSid(jd)) / NAK_SPAN);
    const nextBoundary = ((idx + 1) * NAK_SPAN) % 360;
    const endJD = findCrossing(moonSid, nextBoundary, jd, 1.5) ?? toJD;
    const segEnd = Math.min(endJD, toJD);
    const base = { nakshatra: NAKSHATRAS[idx], nakshatraHi: NAKSHATRAS_HI[idx], startISO: iso(jd), endISO: iso(segEnd) };
    if (SARVARTHA[weekday].includes(idx)) out.push({ kind: 'sarvartha', ...base });
    if (AMRIT[weekday] === idx) out.push({ kind: 'amrit', ...base });
    jd = endJD + 1e-5;
  }
  return out;
}

/* ── Bhadra (Vishti karana) ──────────────────────────────────────────────── */

const elongAt = (jd: number) => norm360(calcPlanet('Mo', jd, false).lon - calcPlanet('Su', jd, false).lon);
/** 0..59 half-tithi index (each 6° of Moon–Sun elongation) */
export const halfTithiAt = (jd: number) => Math.floor(elongAt(jd) / 6);
/** Vishti = the 7th movable karana; karana numbers 2..57 repeat the 7 movable ones. */
export const isVishtiHalf = (h: number) => {
  const k = h + 1;
  return k >= 2 && k <= 57 && (k - 2) % 7 === 6;
};
/** is the Vishti (Bhadra) karana running at this instant? */
export const isBhadraAt = (jd: number) => isVishtiHalf(halfTithiAt(jd));

export function bhadraWindows(fromJD: number, toJD: number): { startISO: string; endISO: string }[] {
  const out: { startISO: string; endISO: string }[] = [];
  let jd = fromJD;
  for (let guard = 0; guard < 6 && jd < toJD; guard++) {
    const h = halfTithiAt(jd);
    const endJD = findCrossing(elongAt, ((h + 1) * 6) % 360, jd, 1.0) ?? toJD;
    if (isVishtiHalf(h)) out.push({ startISO: iso(jd), endISO: iso(Math.min(endJD, toJD)) });
    jd = endJD + 1e-5;
  }
  return out;
}

/* ── Panchak (Moon in the last 5½ nakshatras: Dhanishta pada 3 → Revati) ─── */

const PANCHAK_START = 293 + 20 / 60; // 293°20′ sidereal
export const isPanchakAt = (jd: number) => moonSid(jd) >= PANCHAK_START;

export interface PanchakInfo {
  inEffect: boolean;
  startsToday: boolean;
  startISO: string | null;
  endISO: string | null;
}

export function panchakInfo(fromJD: number, toJD: number): PanchakInfo {
  const nowIn = isPanchakAt(fromJD);
  if (nowIn) {
    const start = findCrossing(moonSid, PANCHAK_START, fromJD - 6, 6.2);
    const end = findCrossing(moonSid, 0, fromJD, 3);
    return { inEffect: true, startsToday: false, startISO: start ? iso(start) : null, endISO: end ? iso(end) : null };
  }
  const start = findCrossing(moonSid, PANCHAK_START, fromJD, toJD - fromJD);
  if (start) {
    const end = findCrossing(moonSid, 0, start, 3);
    return { inEffect: false, startsToday: true, startISO: iso(start), endISO: end ? iso(end) : null };
  }
  return { inEffect: false, startsToday: false, startISO: null, endISO: null };
}

/* ── Personal: Tara-bala and Chandra-bala ────────────────────────────────── */

const TARA_NAMES = ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyak', 'Sadhana', 'Naidhana', 'Mitra', 'Parama Mitra'];
// Vipat (3), Pratyak (5), Naidhana (7) are the unfavourable taras; Janma (1) is mixed.
const TARA_QUALITY: Quality[] = ['medium', 'good', 'bad', 'good', 'bad', 'good', 'bad', 'good', 'good'];

export interface PersonalBala {
  tara: { number: number; name: string; quality: Quality };
  chandra: { house: number; quality: Quality };
}

/**
 * natalNak / nakNow: 0..26; natalMoonSign / moonSignNow: 0..11.
 * Chandra-bala: Moon in the 1st, 3rd, 6th, 7th, 10th, 11th from the natal Moon sign is good;
 * 4th, 8th, 12th bad; 2nd, 5th, 9th mixed.
 */
export function personalBala(natalNak: number, natalMoonSign: number, nakNow: number, moonSignNow: number): PersonalBala {
  const count = ((nakNow - natalNak + 27) % 27) + 1; // 1..27
  const taraNo = ((count - 1) % 9) + 1; // 1..9
  const house = ((moonSignNow - natalMoonSign + 12) % 12) + 1;
  const quality: Quality = [1, 3, 6, 7, 10, 11].includes(house) ? 'good' : [4, 8, 12].includes(house) ? 'bad' : 'medium';
  return {
    tara: { number: taraNo, name: TARA_NAMES[taraNo - 1], quality: TARA_QUALITY[taraNo - 1] },
    chandra: { house, quality },
  };
}

/* ── One call for the day view ───────────────────────────────────────────── */

export interface MuhurtaExtras {
  hora: HoraSlot[];
  vijaya: { startISO: string; endISO: string };
  yamaganda: { startISO: string; endISO: string };
  gulika: { startISO: string; endISO: string };
  siddhi: SiddhiWindow[];
  bhadra: { startISO: string; endISO: string }[];
  panchak: PanchakInfo;
}

export function muhurtaExtras(srJD: number, ssJD: number, nextSrJD: number, weekday: number): MuhurtaExtras {
  const w = dayWindows(srJD, ssJD, weekday);
  const pair = (x: JDWindow) => ({ startISO: iso(x[0]), endISO: iso(x[1]) });
  return {
    hora: horaSlots(srJD, ssJD, nextSrJD, weekday),
    vijaya: pair(w.vijaya),
    yamaganda: pair(w.yamaganda),
    gulika: pair(w.gulika),
    siddhi: siddhiYogas(weekday, srJD, nextSrJD),
    bhadra: bhadraWindows(srJD, nextSrJD),
    panchak: panchakInfo(srJD, nextSrJD),
  };
}
