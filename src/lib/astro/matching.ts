// ─── Kundli Matching (Ashtakoota Guna Milan) ────────────────────────────────

import { NAKSHATRAS, SIGNS, nakshatraIndex, signIndex, PlanetKey } from './constants';
import { SIGN_VARNA_FALLBACK, YONI_FALLBACK, VASHYA_FALLBACK, NAKSHATRA_GANA_FALLBACK, NAKSHATRA_NADI_FALLBACK } from './matching-fallback';

type Tables = {
  NAKSHATRA_YONI: string[];
  YONI_MATRIX: number[][];
  YONI_NAMES: string[];
  SIGN_VASHYA: string[];
  VASYA_MAP: number[][];
  NAKSHATRA_GANA: string[];
  NAKSHATRA_NADI: string[];
  SIGN_VARNA: string[];
};

function loadTables(): Tables {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./matching-tables');
    if (mod?.NAKSHATRA_YONI && mod?.YONI_MATRIX) return mod;
  } catch {
    /* fall through */
  }
  return {
    NAKSHATRA_YONI: YONI_FALLBACK.NAKSHATRA_YONI,
    YONI_MATRIX: YONI_FALLBACK.YONI_MATRIX,
    YONI_NAMES: YONI_FALLBACK.YONI_NAMES,
    SIGN_VASHYA: VASHYA_FALLBACK.SIGN_VASHYA,
    VASYA_MAP: VASHYA_FALLBACK.VASYA_MAP,
    NAKSHATRA_GANA: NAKSHATRA_GANA_FALLBACK,
    NAKSHATRA_NADI: NAKSHATRA_NADI_FALLBACK,
    SIGN_VARNA: SIGN_VARNA_FALLBACK,
  };
}

const GRAHA_FRIENDS: Record<string, string[]> = {
  Su: ['Mo', 'Ma', 'Ju'],
  Mo: ['Su', 'Me'],
  Ma: ['Su', 'Mo', 'Ju'],
  Me: ['Su', 'Ve'],
  Ju: ['Su', 'Mo', 'Ma'],
  Ve: ['Me', 'Sa'],
  Sa: ['Me', 'Ve'],
};
const GRAHA_ENEMIES: Record<string, string[]> = {
  Su: ['Ve', 'Sa'],
  Mo: [],
  Ma: ['Me'],
  Me: ['Mo'],
  Ju: ['Me', 'Ve'],
  Ve: ['Su', 'Mo'],
  Sa: ['Su', 'Mo', 'Ma'],
};

const VARNA_ORDER: Record<string, number> = { Brahmin: 4, Kshatriya: 3, Vaishya: 2, Shudra: 1 };

export interface KootaScore {
  key: 'Varna' | 'Vashya' | 'Tara' | 'Yoni' | 'Graha Maitri' | 'Gana' | 'Bhakoot' | 'Nadi';
  boy: number;
  girl: number;
  max: number;
  score: number;
  note: string;
}

export interface MatchResult {
  total: number;
  max: number;
  kootas: KootaScore[];
  verdict: 'excellent' | 'good' | 'average' | 'challenging';
  verdictNote: string;
  boyMoon: { sign: number; nakshatra: number; pada: number };
  girlMoon: { sign: number; nakshatra: number; pada: number };
  nadiDosha: boolean;
  bhakootDosha: boolean;
  ganaDosha: boolean;
}

const pad = (n: number, l: number) => (n % l + l) % l;

export function ashtakoota(
  boy: { moonLon: number },
  girl: { moonLon: number },
): MatchResult {
  const T = loadTables();
  const bSign = signIndex(boy.moonLon);
  const gSign = signIndex(girl.moonLon);
  const bNak = nakshatraIndex(boy.moonLon);
  const gNak = nakshatraIndex(girl.moonLon);
  const kootas: KootaScore[] = [];

  // 1. Varna (1)
  const bVarna = T.SIGN_VARNA[bSign];
  const gVarna = T.SIGN_VARNA[gSign];
  const varnaScore = VARNA_ORDER[bVarna] >= VARNA_ORDER[gVarna] ? 1 : 0;
  kootas.push({ key: 'Varna', boy: bSign, girl: gSign, max: 1, score: varnaScore, note: `Boy ${bVarna} / Girl ${gVarna}` });

  // 2. Vashya (2)
  const bV = T.SIGN_VASHYA[bSign];
  const gV = T.SIGN_VASHYA[gSign];
  const bVasya = T.VASYA_MAP[bSign].includes(gSign);
  const gVasya = T.VASYA_MAP[gSign].includes(bSign);
  const vashyaScore = bV === gV ? 2 : bVasya || gVasya ? 2 : 1;
  kootas.push({ key: 'Vashya', boy: bSign, girl: gSign, max: 2, score: vashyaScore, note: `Boy ${bV} / Girl ${gV}` });

  // 3. Tara (3)
  const taraN = (from: number, to: number) => pad(to - from, 27) + 1;
  const taraGood = (n: number) => [2, 4, 6, 8, 9].includes(((n - 1) % 9) + 1);
  const boyToGirl = taraN(bNak, gNak);
  const girlToBoy = taraN(gNak, bNak);
  const bOk = taraGood(boyToGirl);
  const gOk = taraGood(girlToBoy);
  const taraScore = bOk && gOk ? 3 : bOk || gOk ? 1.5 : 0;
  kootas.push({ key: 'Tara', boy: bNak, girl: gNak, max: 3, score: taraScore, note: `Stars ${boyToGirl}/${girlToBoy}` });

  // 4. Yoni (4)
  const bYoni = T.NAKSHATRA_YONI[bNak];
  const gYoni = T.NAKSHATRA_YONI[gNak];
  const yoniIdxB = T.YONI_NAMES.indexOf(bYoni);
  const yoniIdxG = T.YONI_NAMES.indexOf(gYoni);
  const yoniScore = yoniIdxB >= 0 && yoniIdxG >= 0 ? T.YONI_MATRIX[yoniIdxB][yoniIdxG] : 2;
  kootas.push({ key: 'Yoni', boy: bNak, girl: gNak, max: 4, score: yoniScore, note: `${bYoni} / ${gYoni}` });

  // 5. Graha Maitri (5)
  const LORDS: Record<number, PlanetKey> = { 0: 'Ma', 1: 'Ve', 2: 'Me', 3: 'Mo', 4: 'Su', 5: 'Me', 6: 'Ve', 7: 'Ma', 8: 'Ju', 9: 'Sa', 10: 'Sa', 11: 'Ju' };
  const bLord = LORDS[bSign];
  const gLord = LORDS[gSign];
  let maitriScore: number;
  if (bLord === gLord) maitriScore = 5;
  else {
    const b2g = GRAHA_FRIENDS[bLord].includes(gLord) ? 'F' : GRAHA_ENEMIES[bLord].includes(gLord) ? 'E' : 'N';
    const g2b = GRAHA_FRIENDS[gLord].includes(bLord) ? 'F' : GRAHA_ENEMIES[gLord].includes(bLord) ? 'E' : 'N';
    const pair = b2g + g2b;
    maitriScore = pair === 'FF' ? 5 : pair === 'FN' || pair === 'NF' ? 4 : pair === 'NN' ? 3 : pair === 'FE' || pair === 'EF' ? 1 : pair === 'NE' || pair === 'EN' ? 0.5 : 0;
  }
  kootas.push({ key: 'Graha Maitri', boy: bSign, girl: gSign, max: 5, score: maitriScore, note: `Lords ${bLord}/${gLord}` });

  // 6. Gana (6)
  const bGana = T.NAKSHATRA_GANA[bNak];
  const gGana = T.NAKSHATRA_GANA[gNak];
  const ganaScore = bGana === gGana ? 6 : (bGana === 'Deva' && gGana === 'Manushya') || (bGana === 'Manushya' && gGana === 'Deva') ? 5 : (bGana === 'Deva' && gGana === 'Rakshasa') || (bGana === 'Rakshasa' && gGana === 'Deva') ? 1 : 0;
  kootas.push({ key: 'Gana', boy: bNak, girl: gNak, max: 6, score: ganaScore, note: `${bGana} / ${gGana}` });

  // 7. Bhakoot (7)
  const d = pad(gSign - bSign, 12);
  const bhakootDosha = [1, 11, 4, 8, 6].includes(d) || d === 6;
  const bhakootScore = bhakootDosha ? 0 : 7;
  kootas.push({ key: 'Bhakoot', boy: bSign, girl: gSign, max: 7, score: bhakootScore, note: `${SIGNS[bSign]}/${SIGNS[gSign]}` });

  // 8. Nadi (8)
  const bNadi = T.NAKSHATRA_NADI[bNak];
  const gNadi = T.NAKSHATRA_NADI[gNak];
  const nadiScore = bNadi === gNadi ? 0 : 8;
  kootas.push({ key: 'Nadi', boy: bNak, girl: gNak, max: 8, score: nadiScore, note: `${bNadi} / ${gNadi}` });

  const total = Math.round(kootas.reduce((a, k) => a + k.score, 0) * 2) / 2;
  const verdict = total >= 33 ? 'excellent' : total >= 25 ? 'good' : total >= 18 ? 'average' : 'challenging';
  const verdictNote =
    total >= 24
      ? 'Above the 18-point threshold — traditionally considered a compatible match.'
      : total >= 18
        ? 'Meets the minimum 18/36 threshold. Consider the dosha notes below.'
        : 'Below the traditional 18/36 threshold. Consultation is traditionally advised.';

  return {
    total,
    max: 36,
    kootas,
    verdict,
    verdictNote,
    boyMoon: { sign: bSign, nakshatra: bNak, pada: pad(Math.floor(((boy.moonLon % (360 / 27)) / (360 / 108))) , 4) + 1 },
    girlMoon: { sign: gSign, nakshatra: gNak, pada: pad(Math.floor(((girl.moonLon % (360 / 27)) / (360 / 108))), 4) + 1 },
    nadiDosha: bNadi === gNadi,
    bhakootDosha,
    ganaDosha: ganaScore <= 1,
  };
}
