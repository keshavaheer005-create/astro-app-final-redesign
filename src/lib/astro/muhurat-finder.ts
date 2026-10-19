// ─── Muhurat Finder ─────────────────────────────────────────────────────────
//
// Walks day by day, scores every half-hour slot between sunrise and sunset
// against the traditional rules for an activity, merges the good slots into
// time windows and ranks the days.
//
// This is *guidance from published classical rules*, not a priest's verdict:
// for a wedding or a house-warming a priest should still confirm the lagna
// and family-specific factors. The UI says so.

import { TITHIS, TITHIS_HI, NAKSHATRAS, NAKSHATRAS_HI, norm360, signIndex } from './constants';
import { ayanamsa, calcPlanet, juldayFromUTC, riseTrans, utcFromJulday } from './ephemeris';
import { choghadiyaQualityAt, daySummaryFor } from './panchang';
import { enrichLunarDays, type BareDay } from './festivals';
import { zonedToUTC, ymdInZone, weekdayInZone } from '../tz';
import { dayWindows, inWindow, isBhadraAt, isPanchakAt, personalBala, siddhiYogas } from './muhurta';

export const ACTIVITIES = [
  'griha_pravesh',
  'vehicle',
  'business',
  'property',
  'travel',
  'naming',
  'annaprashan',
  'mundan',
  'vidyarambh',
  'vivah',
] as const;
export type Activity = (typeof ACTIVITIES)[number];

const nk = (...names: string[]): number[] =>
  names.map((n) => {
    const i = (NAKSHATRAS as readonly string[]).indexOf(n);
    if (i < 0) throw new Error(`unknown nakshatra ${n}`);
    return i;
  });

interface Rule {
  /** nakshatras that suit the activity */
  nak: number[];
  /** acceptable but weaker nakshatras */
  nakOk?: number[];
  /** nakshatras to avoid outright */
  avoidNak?: number[];
  goodWeekdays: number[]; // 0 = Sunday
  avoidWeekdays: number[];
  /** good tithi numbers within a paksha (1..15) */
  goodTithi: number[];
  /** tithi numbers within a paksha that are ruled out (Amavasya is always ruled out) */
  badTithi: number[];
  /** Venus or Jupiter combust (asta) rules the day out */
  needsLitVenusJupiter?: boolean;
  /** Sun in Sagittarius / Pisces (Kharmas) rules the day out */
  noKharmas?: boolean;
  /** Devshayani → Devutthana Ekadashi (Chaturmas) rules the day out */
  noChaturmas?: boolean;
  /** Panchak counts against the slot */
  panchakPenalty?: number;
  /** Shukla paksha preferred */
  shuklaBonus?: number;
}

const WK_GOOD = [1, 3, 4, 5]; // Mon, Wed, Thu, Fri
const WK_AVOID = [2, 6]; // Tue, Sat
const TITHI_GOOD = [2, 3, 5, 7, 10, 11, 13];
const RIKTA = [4, 9, 14];

const CHILD_NAK = nk(
  'Ashwini', 'Rohini', 'Mrigashira', 'Punarvasu', 'Pushya', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Anuradha',
  'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Uttara Bhadrapada', 'Revati',
);

const RULES: Record<Activity, Rule> = {
  griha_pravesh: {
    nak: nk('Rohini', 'Mrigashira', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Anuradha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Uttara Bhadrapada', 'Revati'),
    nakOk: nk('Ashwini', 'Pushya', 'Punarvasu'),
    avoidNak: nk('Bharani', 'Krittika', 'Ardra', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Vishakha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Purva Bhadrapada', 'Shatabhisha'),
    goodWeekdays: [1, 3, 4],
    avoidWeekdays: WK_AVOID,
    goodTithi: TITHI_GOOD,
    badTithi: [...RIKTA, 8],
    needsLitVenusJupiter: true,
    noKharmas: true,
    noChaturmas: true,
    panchakPenalty: 18,
    shuklaBonus: 5,
  },
  vehicle: {
    nak: nk('Ashwini', 'Mrigashira', 'Punarvasu', 'Pushya', 'Hasta', 'Chitra', 'Swati', 'Anuradha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Revati'),
    goodWeekdays: WK_GOOD,
    avoidWeekdays: WK_AVOID,
    goodTithi: [...TITHI_GOOD, 15],
    badTithi: RIKTA,
  },
  business: {
    nak: nk('Ashwini', 'Rohini', 'Mrigashira', 'Punarvasu', 'Pushya', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Anuradha', 'Shravana', 'Dhanishta', 'Uttara Ashadha', 'Uttara Bhadrapada', 'Revati'),
    goodWeekdays: WK_GOOD,
    avoidWeekdays: WK_AVOID,
    goodTithi: [...TITHI_GOOD, 15],
    badTithi: RIKTA,
  },
  property: {
    nak: nk('Rohini', 'Mrigashira', 'Punarvasu', 'Pushya', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Anuradha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Uttara Bhadrapada', 'Revati'),
    goodWeekdays: WK_GOOD,
    avoidWeekdays: WK_AVOID,
    goodTithi: TITHI_GOOD,
    badTithi: RIKTA,
    panchakPenalty: 12,
  },
  travel: {
    nak: nk('Ashwini', 'Mrigashira', 'Punarvasu', 'Pushya', 'Hasta', 'Anuradha', 'Shravana', 'Dhanishta', 'Revati'),
    goodWeekdays: WK_GOOD,
    avoidWeekdays: WK_AVOID,
    goodTithi: TITHI_GOOD,
    badTithi: RIKTA,
  },
  naming: {
    nak: CHILD_NAK,
    goodWeekdays: WK_GOOD,
    avoidWeekdays: WK_AVOID,
    goodTithi: TITHI_GOOD,
    badTithi: RIKTA,
  },
  annaprashan: {
    nak: CHILD_NAK,
    goodWeekdays: WK_GOOD,
    avoidWeekdays: WK_AVOID,
    goodTithi: TITHI_GOOD,
    badTithi: RIKTA,
  },
  mundan: {
    nak: nk('Ashwini', 'Mrigashira', 'Punarvasu', 'Pushya', 'Hasta', 'Chitra', 'Swati', 'Anuradha', 'Jyeshtha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Revati'),
    goodWeekdays: WK_GOOD,
    avoidWeekdays: [0, 2, 6],
    goodTithi: TITHI_GOOD,
    badTithi: [...RIKTA, 8],
    needsLitVenusJupiter: true,
    noKharmas: true,
    noChaturmas: true,
  },
  vidyarambh: {
    nak: nk('Ashwini', 'Mrigashira', 'Punarvasu', 'Pushya', 'Hasta', 'Chitra', 'Swati', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Revati'),
    goodWeekdays: WK_GOOD,
    avoidWeekdays: WK_AVOID,
    goodTithi: TITHI_GOOD,
    badTithi: RIKTA,
  },
  vivah: {
    nak: nk('Rohini', 'Mrigashira', 'Magha', 'Uttara Phalguni', 'Hasta', 'Swati', 'Anuradha', 'Mula', 'Uttara Ashadha', 'Uttara Bhadrapada', 'Revati'),
    goodWeekdays: WK_GOOD,
    avoidWeekdays: WK_AVOID,
    goodTithi: [2, 3, 5, 7, 10, 11, 12, 13],
    badTithi: [...RIKTA, 8],
    needsLitVenusJupiter: true,
    noKharmas: true,
    noChaturmas: true,
    panchakPenalty: 10,
  },
};

// Yogas (1-based) traditionally avoided for new beginnings
const BAD_YOGAS = new Set([1, 6, 9, 10, 13, 15, 17, 19, 27]);

/* ── Result types ────────────────────────────────────────────────────────── */

export interface Reason {
  key: string;
  vars?: Record<string, string | number>;
}

export interface MuhuratWindowOut {
  startISO: string;
  endISO: string;
  score: number;
}

export interface MuhuratDay {
  date: string;
  weekday: number;
  score: number;
  verdict: 'excellent' | 'good' | 'fair';
  tithi: { name: string; nameHi: string; paksha: 'Shukla' | 'Krishna' };
  nakshatra: { name: string; nameHi: string };
  windows: MuhuratWindowOut[];
  positives: Reason[];
  cautions: Reason[];
}

export interface FinderInput {
  activity: Activity;
  startDate: string; // YYYY-MM-DD (local)
  days: number;
  lat: number;
  lng: number;
  timezone: string;
  /** natal Moon (optional) → personal Tara-bala / Chandra-bala */
  natalNak?: number;
  natalMoonSign?: number;
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

const angDiff = (a: number, b: number) => {
  const d = Math.abs(norm360(a) - norm360(b));
  return d > 180 ? 360 - d : d;
};

/** Chaturmas = Devshayani Ekadashi → Devutthana Ekadashi. Local date range for a year, or null. */
function chaturmasRange(year: number, timezone: string, lat: number, lng: number): [string, string] | null {
  const all: BareDay[] = [];
  // scan mid-June → mid-December, padded so the lunar-month lookup resolves
  const start = Date.UTC(year, 5, 1, 12);
  for (let i = 0; i < 215; i++) {
    const base = start + i * 86400000;
    const dt = new Date(base);
    const noonUTC = zonedToUTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), 12, 0, timezone);
    const localDate = ymdInZone(timezone, noonUTC);
    const s = daySummaryFor(noonUTC, localDate, weekdayInZone(timezone, noonUTC), lat, lng);
    all.push({ date: s.date, tithiIdx0: s.tithiIdx0, nakIdx: s.nakIdx, sunSignIdx: s.sunSignIdx, elong: s.elong });
  }
  const enriched = enrichLunarDays(all, new Set(all.map((d) => d.date)));
  let from: string | null = null;
  let to: string | null = null;
  for (const d of all) {
    const fest = enriched.get(d.date)?.festivals ?? [];
    if (!from && fest.some((f) => f.en === 'Devshayani Ekadashi')) from = d.date;
    if (from && !to && fest.some((f) => f.en === 'Devutthana Ekadashi')) to = d.date;
  }
  return from && to ? [from, to] : null;
}

/* ── the finder ──────────────────────────────────────────────────────────── */

const STEP_MIN = 30;

export function findMuhurats(input: FinderInput): MuhuratDay[] {
  const rule = RULES[input.activity];
  const [y0, m0, d0] = input.startDate.split('-').map(Number);
  const out: MuhuratDay[] = [];
  const chaturmasCache = new Map<number, [string, string] | null>();

  for (let i = 0; i < input.days; i++) {
    const base = new Date(Date.UTC(y0, m0 - 1, d0 + i, 12));
    const yy = base.getUTCFullYear();
    const mm = base.getUTCMonth() + 1;
    const dd = base.getUTCDate();
    const noonUTC = zonedToUTC(yy, mm, dd, 12, 0, input.timezone);
    const localDate = ymdInZone(input.timezone, noonUTC);
    const weekday = weekdayInZone(input.timezone, noonUTC);
    const jdNoon = juldayFromUTC(noonUTC);

    const sr = riseTrans(jdNoon - 0.6, 'Su', true, input.lat, input.lng);
    const ss = riseTrans(jdNoon - 0.6, 'Su', false, input.lat, input.lng);
    if (!sr || !ss) continue;
    const nextSr = riseTrans(ss - 0.05, 'Su', true, input.lat, input.lng) ?? ss + 1;

    const cautions: Reason[] = [];
    const positives: Reason[] = [];

    /* — day-level hard rules — */
    const sunSid = calcPlanet('Su', jdNoon, true).lon;
    const sunSign = signIndex(sunSid);
    if (rule.noKharmas && (sunSign === 8 || sunSign === 11)) continue; // Sun in Sagittarius / Pisces
    if (rule.needsLitVenusJupiter) {
      const venus = calcPlanet('Ve', jdNoon, true).lon;
      const jup = calcPlanet('Ju', jdNoon, true).lon;
      if (angDiff(venus, sunSid) <= 10 || angDiff(jup, sunSid) <= 11) continue; // Shukra / Guru asta
    }
    if (rule.noChaturmas) {
      if (!chaturmasCache.has(yy)) chaturmasCache.set(yy, chaturmasRange(yy, input.timezone, input.lat, input.lng));
      const cm = chaturmasCache.get(yy);
      if (cm && localDate >= cm[0] && localDate < cm[1]) continue;
    }
    if (rule.avoidWeekdays.includes(weekday)) cautions.push({ key: 'weekdayAvoid' });

    const w = dayWindows(sr, ss, weekday);
    const siddhi = siddhiYogas(weekday, sr, nextSr);

    /* — slot scan — */
    const slotLen = STEP_MIN / 1440;
    const n = Math.floor((ss - sr) / slotLen);
    interface Slot { start: number; end: number; score: number; pos: Reason[]; caut: Reason[]; nakIdx: number; tithiNo: number; paksha: 'Shukla' | 'Krishna' }
    const slots: Slot[] = [];
    for (let s = 0; s < n; s++) {
      const start = sr + s * slotLen;
      const end = start + slotLen;
      const mid = start + slotLen / 2;
      if (inWindow(mid, w.rahu) || inWindow(mid, w.yamaganda) || inWindow(mid, w.gulika)) continue;

      const sun = calcPlanet('Su', mid, false).lon;
      const moon = calcPlanet('Mo', mid, false).lon;
      const ay = ayanamsa(mid);
      const elong = norm360(moon - sun);
      const tithiIdx0 = Math.floor(elong / 12); // 0..29
      const tithiNo = tithiIdx0 + 1; // 1..30
      const paksha: 'Shukla' | 'Krishna' = tithiIdx0 < 15 ? 'Shukla' : 'Krishna';
      const inPaksha = tithiNo === 30 ? 15 : ((tithiNo - 1) % 15) + 1;
      const moonSidLon = norm360(moon - ay);
      const nakIdx = Math.floor(moonSidLon / (360 / 27));
      const yogaNo = Math.floor(norm360(moon + sun - 2 * ay) / (360 / 27)) + 1;

      const pos: Reason[] = [];
      const caut: Reason[] = [];
      let score = 40;

      // hard blocks
      if (tithiNo === 30 || rule.badTithi.includes(inPaksha)) continue;
      if (rule.avoidNak?.includes(nakIdx)) continue;
      if (BAD_YOGAS.has(yogaNo)) continue;
      if (isBhadraAt(mid)) continue;

      // nakshatra
      if (rule.nak.includes(nakIdx)) {
        score += 22;
        pos.push({ key: 'nakGood', vars: { name: NAKSHATRAS[nakIdx] } });
      } else if (rule.nakOk?.includes(nakIdx)) {
        score += 10;
        pos.push({ key: 'nakOk', vars: { name: NAKSHATRAS[nakIdx] } });
      } else {
        continue; // not a suitable nakshatra for this activity
      }

      // tithi
      if (rule.goodTithi.includes(inPaksha)) {
        score += 10;
        pos.push({ key: 'tithiGood', vars: { name: TITHIS[(tithiNo - 1) % 15] } });
      }
      if (rule.shuklaBonus && paksha === 'Shukla') score += rule.shuklaBonus;

      // weekday
      if (rule.goodWeekdays.includes(weekday)) {
        score += 10;
        pos.push({ key: 'weekdayGood' });
      } else if (rule.avoidWeekdays.includes(weekday)) {
        score -= 18;
      }

      // Choghadiya
      const ch = choghadiyaQualityAt(weekday, sr, ss, nextSr, mid);
      if (ch.quality === 'good') {
        score += 10;
        pos.push({ key: 'choghGood', vars: { name: ch.name } });
      } else if (ch.quality === 'bad') {
        score -= 15;
        caut.push({ key: 'choghBad', vars: { name: ch.name } });
      }

      // Abhijit
      if (inWindow(mid, w.abhijit)) {
        score += 8;
        pos.push({ key: 'abhijit' });
      }

      // Siddhi yogas
      for (const sy of siddhi) {
        const a = new Date(sy.startISO).getTime();
        const b = new Date(sy.endISO).getTime();
        const t = utcFromJulday(mid).getTime();
        if (t >= a && t < b) {
          score += sy.kind === 'amrit' ? 14 : 10;
          pos.push({ key: sy.kind === 'amrit' ? 'amritSiddhi' : 'sarvarthaSiddhi' });
        }
      }

      // Panchak
      if (rule.panchakPenalty && isPanchakAt(mid)) {
        score -= rule.panchakPenalty;
        caut.push({ key: 'panchak' });
      }

      // personal bala
      if (input.natalNak != null && input.natalMoonSign != null) {
        const pb = personalBala(input.natalNak, input.natalMoonSign, nakIdx, signIndex(moonSidLon));
        if (pb.chandra.quality === 'good') {
          score += 6;
          pos.push({ key: 'chandraGood', vars: { house: pb.chandra.house } });
        } else if (pb.chandra.quality === 'bad') {
          score -= 15;
          caut.push({ key: 'chandraBad', vars: { house: pb.chandra.house } });
        }
        if (pb.tara.quality === 'bad') {
          score -= 15;
          caut.push({ key: 'taraBad', vars: { name: pb.tara.name } });
        } else if (pb.tara.quality === 'good') {
          score += 4;
        }
      }

      slots.push({ start, end, score: Math.max(0, Math.min(100, score)), pos, caut, nakIdx, tithiNo, paksha });
    }
    if (slots.length === 0) continue;

    /* — merge adjacent slots into windows — */
    const windows: (MuhuratWindowOut & { slots: Slot[] })[] = [];
    for (const sl of slots) {
      const last = windows[windows.length - 1];
      if (last && Math.abs(new Date(last.endISO).getTime() - utcFromJulday(sl.start).getTime()) < 1000) {
        last.endISO = utcFromJulday(sl.end).toISOString();
        last.slots.push(sl);
        last.score = Math.max(last.score, sl.score);
      } else {
        windows.push({ startISO: utcFromJulday(sl.start).toISOString(), endISO: utcFromJulday(sl.end).toISOString(), score: sl.score, slots: [sl] });
      }
    }
    // windows shorter than 30 min are unusable; rank the rest
    windows.sort((a, b) => b.score - a.score);
    const best = windows[0];
    const bestSlot = best.slots.reduce((m, s) => (s.score > m.score ? s : m), best.slots[0]);
    if (bestSlot.score < 62) continue;

    // collapse reason lists from the best slot, de-duplicated
    const dedupe = (rs: Reason[]) => rs.filter((r, idx) => rs.findIndex((x) => x.key === r.key) === idx);
    const tithiName = (n: number) => ({
      name: n === 30 ? 'Amavasya' : TITHIS[(n - 1) % 15],
      nameHi: n === 30 ? 'अमावस्या' : TITHIS_HI[(n - 1) % 15],
    });
    const tn = tithiName(bestSlot.tithiNo);

    out.push({
      date: localDate,
      weekday,
      score: bestSlot.score,
      verdict: bestSlot.score >= 100 ? 'excellent' : bestSlot.score >= 80 ? 'good' : 'fair',
      tithi: { ...tn, paksha: bestSlot.paksha },
      nakshatra: { name: NAKSHATRAS[bestSlot.nakIdx], nameHi: NAKSHATRAS_HI[bestSlot.nakIdx] },
      windows: windows.slice(0, 2).map(({ startISO, endISO, score }) => ({ startISO, endISO, score })),
      positives: dedupe(bestSlot.pos),
      cautions: dedupe([...cautions, ...bestSlot.caut]),
    });
  }

  // best first; dates stay in order within equal scores
  out.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
  return out;
}

