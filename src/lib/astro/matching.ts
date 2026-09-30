// ─── Kundli Matching (Ashtakoota Guna Milan) ────────────────────────────────

import { SIGNS, nakshatraIndex, signIndex, PlanetKey } from './constants';
import {
  NAKSHATRA_YONI, YONI_MATRIX, YONI_NAMES, VASHYA_GROUPS, VASHYA_MATRIX, vashyaGroup,
  NAKSHATRA_GANA, GANA_MATRIX, NAKSHATRA_NADI, SIGN_VARNA,
} from './matching-tables';
import { degInSign } from './constants';

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

export const SIGN_LORD_KEYS: PlanetKey[] = ['Ma', 'Ve', 'Me', 'Mo', 'Su', 'Me', 'Ve', 'Ma', 'Ju', 'Sa', 'Sa', 'Ju'];

/** Graha Maitri points (0-5) for two sign lords. */
export function grahaMaitriScore(bLord: PlanetKey, gLord: PlanetKey): number {
  if (bLord === gLord) return 5;
  const b2g = GRAHA_FRIENDS[bLord].includes(gLord) ? 'F' : GRAHA_ENEMIES[bLord].includes(gLord) ? 'E' : 'N';
  const g2b = GRAHA_FRIENDS[gLord].includes(bLord) ? 'F' : GRAHA_ENEMIES[gLord].includes(bLord) ? 'E' : 'N';
  const pair = b2g + g2b;
  return pair === 'FF' ? 5 : pair === 'FN' || pair === 'NF' ? 4 : pair === 'NN' ? 3 : pair === 'FE' || pair === 'EF' ? 1 : pair === 'NE' || pair === 'EN' ? 0.5 : 0;
}

const pad = (n: number, l: number) => (n % l + l) % l;

export function ashtakoota(
  boy: { moonLon: number },
  girl: { moonLon: number },
): MatchResult {
  const T = { NAKSHATRA_YONI, YONI_MATRIX, YONI_NAMES, NAKSHATRA_GANA, NAKSHATRA_NADI, SIGN_VARNA };
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

  // 2. Vashya (2) — groups depend on the Moon's degree for Sagittarius/Capricorn.
  //    Matrix rows = bride's group, columns = groom's group.
  const bV = vashyaGroup(bSign, degInSign(boy.moonLon));
  const gV = vashyaGroup(gSign, degInSign(girl.moonLon));
  const vashyaScore = VASHYA_MATRIX[VASHYA_GROUPS.indexOf(gV)][VASHYA_GROUPS.indexOf(bV)];
  kootas.push({ key: 'Vashya', boy: bSign, girl: gSign, max: 2, score: vashyaScore, note: `Boy ${bV} / Girl ${gV}` });

  // 3. Tara (3)
  const taraN = (from: number, to: number) => pad(to - from, 27) + 1;
  // Remainder of count/9: 3 (Vipat), 5 (Pratyari), 7 (Vadha) are inauspicious;
  // everything else (incl. 1 = Janma, 9/0 = Parama Mitra) is good. This matches
  // AstroSage (Punarvasu/Vishakha = counts 10/19 -> 3/3).
  const taraGood = (n: number) => ![3, 5, 7].includes(((n - 1) % 9) + 1);
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
  const bLord = SIGN_LORD_KEYS[bSign];
  const gLord = SIGN_LORD_KEYS[gSign];
  const maitriScore = grahaMaitriScore(bLord, gLord);
  kootas.push({ key: 'Graha Maitri', boy: bSign, girl: gSign, max: 5, score: maitriScore, note: `Lords ${bLord}/${gLord}` });

  // 6. Gana (6)
  const bGana = T.NAKSHATRA_GANA[bNak];
  const gGana = T.NAKSHATRA_GANA[gNak];
  const ganaScore = GANA_MATRIX[bGana as 'Deva' | 'Manushya' | 'Rakshasa'][gGana as 'Deva' | 'Manushya' | 'Rakshasa'];
  kootas.push({ key: 'Gana', boy: bNak, girl: gNak, max: 6, score: ganaScore, note: `${bGana} / ${gGana}` });

  // 7. Bhakoot (7)
  const d = pad(gSign - bSign, 12);
  // Dosha when the signs are 2/12, 5/9 or 6/8 from each other
  // (0-based sign difference 1 or 11, 4 or 8, 5 or 7). 7/7 (difference 6) is fine.
  const bhakootDosha = [1, 11, 4, 8, 5, 7].includes(d);
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
