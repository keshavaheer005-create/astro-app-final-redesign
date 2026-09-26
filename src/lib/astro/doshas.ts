// ─── Doshas: Mangal Dosha & Sade Sati ───────────────────────────────────────

import { SIGNS, SIGNS_HI, signIndex, norm360, PlanetKey } from './constants';
import { calcPlanet, juldayFromUTC } from './ephemeris';

export interface MangalDoshaResult {
  fromAsc: boolean;
  fromMoon: boolean;
  marsHouseFromAsc: number;
  marsHouseFromMoon: number;
  mitigated: boolean;
  reasons: string[];
  severity: 'none' | 'mild' | 'moderate' | 'strong';
}

const DOSHA_HOUSES = [1, 2, 4, 7, 8, 12];

export function mangalDosha(planets: Record<PlanetKey, { lon: number; house: number; sign: number }>, ascLon: number): MangalDoshaResult {
  const mars = planets.Ma;
  const hAsc = mars.house;
  const hMoon = ((mars.sign - signIndex(planets.Mo.lon) + 12) % 12) + 1;
  const fromAsc = DOSHA_HOUSES.includes(hAsc);
  const fromMoon = DOSHA_HOUSES.includes(hMoon);

  const reasons: string[] = [];
  let mitigated = false;

  // Classical cancellations (subset, commonly accepted)
  if (mars.sign === 0 || mars.sign === 7) {
    // own sign Aries / Scorpio
    mitigated = true;
    reasons.push('Mars occupies its own sign (Aries/Scorpio), a classical cancellation');
  }
  if (mars.sign === 9) {
    mitigated = true;
    reasons.push('Mars is exalted in Capricorn, a classical cancellation');
  }
  const jupiterAspectHouses = [((planets.Ju.house - 1) % 12) + 1]; // whole-sign aspect = trines + 7th
  const juTrines = [planets.Ju.house, ((planets.Ju.house + 3) % 12) + 1, ((planets.Ju.house + 7) % 12) + 1, ((planets.Ju.house + 11) % 12) + 1];
  if (juTrines.includes(hAsc) || juTrines.includes(((hAsc + 6 - 1) % 12) + 1)) {
    // Jupiter aspecting Mars by trine/7th from its house
    if (juTrines.includes(mars.house)) {
      mitigated = true;
      reasons.push('Jupiter aspects Mars, softening the dosha');
    }
  }
  void jupiterAspectHouses;
  if (hAsc === 2 || hAsc === 12) {
    reasons.push('Dosha from the Lagna in house ' + hAsc + ' is considered milder by many traditions');
  }

  const both = fromAsc && fromMoon;
  const severity: MangalDoshaResult['severity'] = !fromAsc && !fromMoon
    ? 'none'
    : mitigated
      ? 'mild'
      : both
        ? 'strong'
        : 'moderate';

  return {
    fromAsc,
    fromMoon,
    marsHouseFromAsc: hAsc,
    marsHouseFromMoon: hMoon,
    mitigated: mitigated || (!fromAsc && !fromMoon),
    reasons,
    severity,
  };
}

// ─── Sade Sati ───────────────────────────────────────────────────────────────

export interface SadeSatiPhase {
  key: 'rising' | 'peak' | 'setting';
  start: string;
  end: string;
}

export interface SadeSatiResult {
  active: boolean;
  phase: SadeSatiPhase['key'] | null;
  window: { start: string; end: string } | null;
  phases: SadeSatiPhase[];
  saturnSignNow: number;
  moonSignNatal: number;
  note: string;
}

function saturnSignAt(date: Date): number {
  return signIndex(calcPlanet('Sa', juldayFromUTC(date), true).lon);
}

function findIngress(from: Date, to: Date, targetSign: number): Date | null {
  // scan in 20-day steps, bisect on sign change to targetSign
  const lo = from.getTime();
  const hi = to.getTime();
  const stepMs = 20 * 86400000;
  for (let t = lo; t < hi; t += stepMs) {
    const a = saturnSignAt(new Date(t));
    const b = saturnSignAt(new Date(Math.min(t + stepMs, hi)));
    if (a !== b) {
      // bisect between t and t+step
      let l = t;
      let h = t + stepMs;
      for (let i = 0; i < 30; i++) {
        const mid = (l + h) / 2;
        if (saturnSignAt(new Date(mid)) === saturnSignAt(new Date(l))) l = mid;
        else h = mid;
      }
      if (saturnSignAt(new Date(h)) === targetSign) return new Date(h);
    }
  }
  if (saturnSignAt(from) === targetSign) return from;
  return null;
}

export function sadeSati(natalMoonLon: number, now: Date): SadeSatiResult {
  const moonSign = signIndex(natalMoonLon);
  const saturnSign = saturnSignAt(now);
  const offset = ((saturnSign - moonSign) % 12 + 12) % 12; // 0 = same sign
  const active = offset === 11 || offset === 0 || offset === 1;

  // Find current window: Saturn entering 12th from Moon → leaving 2nd from Moon
  const startTwelfth = findIngress(new Date(now.getTime() - 13 * 365.25 * 86400000), now, (moonSign + 11) % 12);
  const endSecond = findIngress(now, new Date(now.getTime() + 13 * 365.25 * 86400000), (moonSign + 2) % 12);

  let phases: SadeSatiPhase[] = [];
  let window: { start: string; end: string } | null = null;
  let phase: SadeSatiPhase['key'] | null = null;
  let note = '';

  if (startTwelfth && endSecond) {
    const first = startTwelfth.getTime();
    const last = endSecond.getTime();
    const peakStart = findIngress(new Date(first), new Date(last), moonSign);
    const peakEnd = findIngress(new Date(first), new Date(last), (moonSign + 1) % 12);
    const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
    phases = [
      { key: 'rising', start: fmt(startTwelfth), end: fmt(peakStart) },
      { key: 'peak', start: fmt(peakStart), end: fmt(peakEnd) },
      { key: 'setting', start: fmt(peakEnd), end: fmt(endSecond) },
    ];
    window = { start: fmt(startTwelfth), end: fmt(endSecond) };
    if (offset === 11) phase = 'rising';
    else if (offset === 0) phase = 'peak';
    else if (offset === 1) phase = 'setting';
    note = active
      ? `Sade Sati is active — Saturn is transiting ${offset === 11 ? 'the 12th' : offset === 0 ? 'over natal Moon' : 'the 2nd'} from your Moon sign (${SIGNS[moonSign]}/${SIGNS_HI[moonSign]}).`
      : `Sade Sati is not active. Saturn currently transits ${SIGNS[saturnSign]}/${SIGNS_HI[saturnSign]}, ${offset + 1}th from your Moon sign.`;
  } else {
    note = 'Sade Sati window could not be determined for this chart.';
  }

  return { active, phase, window, phases, saturnSignNow: saturnSign, moonSignNatal: moonSign, note };
}
