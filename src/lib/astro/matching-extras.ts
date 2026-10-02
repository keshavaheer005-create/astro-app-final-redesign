// ─── Matching extras: dosha cancellations, Manglik compatibility, Dashakoota ─
// The headline Ashtakoot score in matching.ts is kept raw (this is how
// AstroSage reports it). Everything here is ADDITIONAL analysis shown beside it.

import { signIndex, nakshatraIndex, NAKSHATRAS } from './constants';
import { MatchResult, grahaMaitriScore, SIGN_LORD_KEYS } from './matching';
import { NAKSHATRA_RAJJU, VEDHA_PAIRS } from './matching-tables';
import type { MangalDoshaResult } from './doshas';

const pad = (n: number, l: number) => ((n % l) + l) % l;
const kootaScore = (m: MatchResult, key: string) => m.kootas.find((k) => k.key === key)?.score ?? 0;

// ── 1. Dosha cancellations (Nadi / Bhakoot / Gana) ──────────────────────────
export interface DoshaItem {
  key: 'Nadi' | 'Bhakoot' | 'Gana';
  present: boolean;
  cancelled: boolean;
  /** Points the koota lost because of the dosha (0 when not present). */
  pointsLost: number;
  reasons: string[];
}
export interface DoshaAnalysis {
  items: DoshaItem[];
  /** Ashtakoot total if the cancelled doshas were restored. Informational only. */
  adjustedTotal: number | null;
}

export function doshaAnalysis(match: MatchResult, boyLon: number, girlLon: number): DoshaAnalysis {
  const bSign = signIndex(boyLon), gSign = signIndex(girlLon);
  const bNak = nakshatraIndex(boyLon), gNak = nakshatraIndex(girlLon);
  const bLord = SIGN_LORD_KEYS[bSign], gLord = SIGN_LORD_KEYS[gSign];
  const lordsSame = bLord === gLord;
  const lordsFriendly = grahaMaitriScore(bLord, gLord) >= 4; // same, or friend(+neutral)
  const padaOf = (lon: number) => Math.floor(((lon % (360 / 27)) / (360 / 108))) + 1;

  // Nadi
  const nadiPresent = match.nadiDosha;
  const nadiReasons: string[] = [];
  if (nadiPresent) {
    if (bSign === gSign && bNak !== gNak) nadiReasons.push('Same Moon sign but different nakshatras — widely accepted Nadi exception');
    if (bNak === gNak && padaOf(boyLon) !== padaOf(girlLon)) nadiReasons.push('Same nakshatra but different padas — widely accepted Nadi exception');
    if (lordsSame || lordsFriendly) nadiReasons.push('Moon-sign lords are the same or friends (accepted by several schools)');
  }

  // Bhakoot
  const bhPresent = match.bhakootDosha;
  const bhReasons: string[] = [];
  if (bhPresent) {
    const navpancham = [4, 8].includes(pad(gSign - bSign, 12));
    const strict = navpancham && !(kootaScore(match, 'Nadi') === 8 && kootaScore(match, 'Tara') === 3);
    if (lordsSame) bhReasons.push('Both Moon signs have the same lord (e.g. Aries–Scorpio, Taurus–Libra, Capricorn–Aquarius)');
    else if (lordsFriendly && !strict) bhReasons.push('Moon-sign lords are mutual friends');
    if (lordsFriendly && strict && !lordsSame) bhReasons.push('Lords are friendly, but Navpancham (5/9) needs full Nadi and Tara points to cancel — not met');
  }
  const bhCancelled = bhReasons.some((r) => !r.includes('not met'));

  // Gana
  const ganaPresent = kootaScore(match, 'Gana') <= 1;
  const ganaReasons: string[] = [];
  if (ganaPresent && (lordsSame || lordsFriendly)) ganaReasons.push('Moon-sign lords are the same or friends — Gana dosha is softened in classical texts');

  const items: DoshaItem[] = [
    { key: 'Nadi', present: nadiPresent, cancelled: nadiPresent && nadiReasons.length > 0, pointsLost: nadiPresent ? 8 : 0, reasons: nadiReasons },
    { key: 'Bhakoot', present: bhPresent, cancelled: bhPresent && bhCancelled, pointsLost: bhPresent ? 7 : 0, reasons: bhReasons },
    { key: 'Gana', present: ganaPresent, cancelled: ganaPresent && ganaReasons.length > 0, pointsLost: ganaPresent ? 6 - kootaScore(match, 'Gana') : 0, reasons: ganaReasons },
  ];
  const restored = items.filter((i) => i.cancelled).reduce((a, i) => a + i.pointsLost, 0);
  return { items, adjustedTotal: restored > 0 ? Math.min(36, match.total + restored) : null };
}

// ── 2. Manglik compatibility (AstroSage-style) ─────────────────────────────
// AstroSage grades each chart None / Low / High (Mars in a dosha house from
// Lagna, Moon and Venus: all three = High, one or two = Low) and calls the pair
// compatible only when both charts have the SAME level.
export type ManglikLevel = 'none' | 'low' | 'high';
export interface ManglikMatch {
  boyLevel: ManglikLevel;
  girlLevel: ManglikLevel;
  compatible: boolean;
  note: string;
}
const LEVEL_WORD: Record<ManglikLevel, string> = { none: 'No', low: 'Low', high: 'High' };
export const levelLabel = (l: ManglikLevel) => `${LEVEL_WORD[l]} Mangal Dosha`;

export function manglikCompatibility(boy: Pick<MangalDoshaResult, 'level'>, girl: Pick<MangalDoshaResult, 'level'>): ManglikMatch {
  const b = boy.level, g = girl.level;
  const compatible = b === g;
  const note = compatible
    ? b === 'none'
      ? 'Neither chart has Mangal dosha — no Manglik concern.'
      : `Both charts have the same level of Mangal dosha (${LEVEL_WORD[b].toLowerCase()}), so the two balance each other.`
    : `The level of Mangal dosha differs (${LEVEL_WORD[b].toLowerCase()} vs ${LEVEL_WORD[g].toLowerCase()}) — a Manglik mismatch, which AstroSage flags as not preferable.`;
  return { boyLevel: b, girlLevel: g, compatible, note };
}

/** AstroSage-style headline: score + Mangal levels + one-line conclusion. */
export interface MatchConclusion {
  lowPoints: boolean;
  manglikMismatch: boolean;
  preferable: boolean;
  text: string;
}
export function matchConclusion(total: number, manglik: ManglikMatch): MatchConclusion {
  const lowPoints = total < 18;
  const manglikMismatch = !manglik.compatible;
  const preferable = !lowPoints && !manglikMismatch;
  const why = lowPoints && manglikMismatch ? 'Mangal Dosha and low match points obtained' : manglikMismatch ? 'Mangal Dosha' : 'low match points obtained';
  return {
    lowPoints,
    manglikMismatch,
    preferable,
    text: preferable ? 'This marriage is preferable — the match points are sufficient and the Mangal Dosha levels agree.' : `This marriage is NOT preferable due to ${why}.`,
  };
}

// ── 3. Dashakoota — South Indian 10 Porutham ────────────────────────────────
// Counts run from the BRIDE's nakshatra to the GROOM's (inclusive), as in the
// Tamil/Kerala method. Conventions differ between schools; the ones used here
// are noted per row. Rajju and Vedha are treated as vetoes.
export interface Porutham {
  key: 'Dina' | 'Gana' | 'Mahendra' | 'Stree Deergha' | 'Yoni' | 'Rasi' | 'Rasyadhipati' | 'Vasya' | 'Rajju' | 'Vedha';
  pass: boolean;
  veto: boolean;
  note: string;
}
export interface DashakootResult {
  items: Porutham[];
  passed: number;
  max: 10;
  verdict: 'recommended' | 'acceptable' | 'not_recommended' | 'rejected';
  rajju: { boy: string; girl: string; active: boolean };
  vedha: { active: boolean };
  note: string;
}

export function dashakoota(match: MatchResult, boyLon: number, girlLon: number): DashakootResult {
  const bSign = signIndex(boyLon), gSign = signIndex(girlLon); // groom, bride
  const bNak = nakshatraIndex(boyLon), gNak = nakshatraIndex(girlLon);
  const count = pad(bNak - gNak, 27) + 1;           // bride star -> groom star
  const rasiCount = pad(bSign - gSign, 12) + 1;     // bride sign -> groom sign
  const items: Porutham[] = [];

  const rem = count % 9;
  items.push({ key: 'Dina', pass: [2, 4, 6, 8, 0].includes(rem), veto: false, note: `Star count ${count} (remainder ${rem}); 2, 4, 6, 8, 0 are favourable` });

  const ganaPts = kootaScore(match, 'Gana');
  items.push({ key: 'Gana', pass: ganaPts >= 5, veto: false, note: `Temperament ${NAKSHATRAS[gNak]} / ${NAKSHATRAS[bNak]} — Ashtakoot Gana ${ganaPts}/6` });

  items.push({ key: 'Mahendra', pass: [4, 7, 10, 13, 16, 19, 22, 25].includes(count), veto: false, note: `Star count ${count}; 4, 7, 10 … 25 are favourable (progeny)` });

  items.push({ key: 'Stree Deergha', pass: count > 13, veto: false, note: `Star count ${count}; groom's star should be beyond the 13th from the bride's` });

  const yoniPts = kootaScore(match, 'Yoni');
  items.push({ key: 'Yoni', pass: yoniPts >= 2, veto: false, note: `Ashtakoot Yoni ${yoniPts}/4 (needs at least 2; enemy animals fail)` });

  let rasiPass: boolean, rasiNote: string;
  if (rasiCount === 1) {
    rasiPass = gNak > bNak;
    rasiNote = rasiPass ? 'Same Moon sign (Eka Rasi) with the bride\'s star after the groom\'s — favourable' : 'Same Moon sign (Eka Rasi) but the bride\'s star does not come after the groom\'s';
  } else {
    rasiPass = ![2, 6, 8, 12].includes(rasiCount);
    rasiNote = `Groom's sign is ${rasiCount}${['th', 'st', 'nd', 'rd'][rasiCount % 10 < 4 && ![11, 12, 13].includes(rasiCount) ? rasiCount % 10 : 0]} from the bride's; 2nd, 6th, 8th and 12th are unfavourable`;
  }
  items.push({ key: 'Rasi', pass: rasiPass, veto: false, note: rasiNote });

  const maitri = grahaMaitriScore(SIGN_LORD_KEYS[bSign], SIGN_LORD_KEYS[gSign]);
  items.push({ key: 'Rasyadhipati', pass: maitri >= 3, veto: false, note: `Sign lords ${SIGN_LORD_KEYS[bSign]}/${SIGN_LORD_KEYS[gSign]} — friendly or neutral passes (Graha Maitri ${maitri}/5)` });

  const vashyaPts = kootaScore(match, 'Vashya');
  items.push({ key: 'Vasya', pass: vashyaPts >= 1, veto: false, note: `Uses the Ashtakoot Vashya result (${vashyaPts}/2); schools differ on the sign table` });

  const bR = NAKSHATRA_RAJJU[bNak], gR = NAKSHATRA_RAJJU[gNak];
  const rajjuActive = bR === gR;
  items.push({ key: 'Rajju', pass: !rajjuActive, veto: true, note: rajjuActive ? `Both stars are on the ${bR} (${rajjuLimb(bR)}) Rajju — Rajju dosha` : `Different Rajju (${gR} / ${bR}) — no dosha` });

  const vedhaActive = VEDHA_PAIRS.some(([a, b]) => (a - 1 === bNak && b - 1 === gNak) || (b - 1 === bNak && a - 1 === gNak));
  items.push({ key: 'Vedha', pass: !vedhaActive, veto: true, note: vedhaActive ? `${NAKSHATRAS[gNak]} and ${NAKSHATRAS[bNak]} are a Vedha pair — they obstruct each other` : 'Neither star obstructs the other — no Vedha' });

  const passed = items.filter((i) => i.pass).length;
  const vetoed = rajjuActive || vedhaActive;
  const verdict: DashakootResult['verdict'] = vetoed ? 'rejected' : passed >= 7 ? 'recommended' : passed >= 5 ? 'acceptable' : 'not_recommended';
  const note = vetoed
    ? 'Rajju/Vedha is treated as disqualifying in the South Indian method, however the other poruthams read.'
    : verdict === 'recommended' ? 'Most poruthams agree and neither Rajju nor Vedha objects.'
    : verdict === 'acceptable' ? 'A workable match — review the failed poruthams below.'
    : 'Several poruthams fail; an astrologer\'s review is advised.';
  return { items, passed, max: 10, verdict, rajju: { boy: bR, girl: gR, active: rajjuActive }, vedha: { active: vedhaActive }, note };
}

function rajjuLimb(g: string): string {
  return ({ Paada: 'feet', Kati: 'waist', Udara: 'stomach', Kantha: 'neck', Siro: 'head' } as Record<string, string>)[g] ?? g;
}
