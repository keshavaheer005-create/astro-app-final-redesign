// ─── Divisional (Varga) charts — Parashari ──────────────────────────────────

import { norm360, signIndex, degInSign, SIGNS, PlanetKey } from './constants';

export const VARGA_LIST = [
  'D1', 'D2', 'D3', 'D7', 'D9', 'D10', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60',
] as const;
export type VargaId = (typeof VARGA_LIST)[number];

export const VARGA_INFO: Record<VargaId, { en: string; parts: number }> = {
  D1: { en: 'Rashi (birth)', parts: 1 },
  D2: { en: 'Hora (wealth)', parts: 2 },
  D3: { en: 'Drekkana (siblings)', parts: 3 },
  D7: { en: 'Saptamsa (children)', parts: 7 },
  D9: { en: 'Navamsa (dharma/spouse)', parts: 9 },
  D10: { en: 'Dasamsa (career)', parts: 10 },
  D12: { en: 'Dwadasamsa (parents)', parts: 12 },
  D16: { en: 'Shodasamsa (vehicles)', parts: 16 },
  D20: { en: 'Vimsamsa (spirituality)', parts: 20 },
  D24: { en: 'Chaturvimsamsa (education)', parts: 24 },
  D27: { en: 'Bhamsha (strengths)', parts: 27 },
  D30: { en: 'Trimsamsa (evils)', parts: 30 },
  D40: { en: 'Khavedamsa (maternal)', parts: 40 },
  D45: { en: 'Akshavedamsa (paternal)', parts: 45 },
  D60: { en: 'Shashtiamsa (karma)', parts: 60 },
};

const ODD: (s: number) => boolean = (s) => s % 2 === 0; // signIndex 0=Aries is odd sign (1st)
const isOddSign = (signIdx: number) => signIdx % 2 === 0;

/** Map a sidereal longitude to its sign in a given varga. */
export function vargaSign(lon: number, varga: VargaId): number {
  const sign = signIndex(lon);
  const deg = degInSign(lon);
  const part = (span: number) => Math.floor(deg / (30 / span));

  switch (varga) {
    case 'D1':
      return sign;
    case 'D2': {
      // Hora: odd signs → first half Leo (Sun), second half Cancer (Moon); even reversed
      const firstHalf = deg < 15;
      if (isOddSign(sign)) return firstHalf ? 4 : 3; // Leo, Cancer
      return firstHalf ? 3 : 4; // Cancer, Leo
    }
    case 'D3':
      return (sign + 4 * part(3)) % 12; // 1st/5th/9th from sign
    case 'D7': {
      const p = part(7);
      return isOddSign(sign) ? (sign + p) % 12 : (sign + 6 + p) % 12;
    }
    case 'D9':
      return Math.floor(norm360(lon) / (30 / 9)) % 12;
    case 'D10': {
      const p = part(10);
      return isOddSign(sign) ? (sign + p) % 12 : (sign + 8 + p) % 12;
    }
    case 'D12':
      return (sign + part(12)) % 12;
    case 'D16': {
      const p = part(16);
      const movable = sign % 3 === 0;
      const fixed = sign % 3 === 1;
      const start = movable ? 0 : fixed ? 4 : 8; // Aries / Leo / Sagittarius
      return (start + p) % 12;
    }
    case 'D20': {
      const p = part(20);
      const movable = sign % 3 === 0;
      const fixed = sign % 3 === 1;
      const start = movable ? 0 : fixed ? 8 : 4; // Aries / Sagittarius / Leo
      return (start + p) % 12;
    }
    case 'D24':
      return ((isOddSign(sign) ? 4 : 3) + part(24)) % 12; // Leo / Cancer start
    case 'D27': {
      const p = part(27);
      const start = [0, 3, 6, 9][sign % 4]; // fire→Aries, earth→Cancer, air→Libra, water→Capricorn
      return (start + p) % 12;
    }
    case 'D30': {
      // Trimsamsa
      if (isOddSign(sign)) {
        if (deg < 5) return 0; // Mars Aries
        if (deg < 10) return 10; // Saturn Aquarius
        if (deg < 18) return 8; // Jupiter Sagittarius
        if (deg < 25) return 2; // Mercury Gemini
        return 6; // Venus Libra
      } else {
        if (deg < 5) return 1; // Venus Taurus
        if (deg < 12) return 5; // Mercury Virgo
        if (deg < 20) return 11; // Jupiter Pisces
        if (deg < 25) return 9; // Saturn Capricorn
        return 7; // Mars Scorpio
      }
    }
    case 'D40':
      return ((isOddSign(sign) ? 0 : 6) + part(40)) % 12; // Aries / Libra
    case 'D45': {
      const p = part(45);
      const movable = sign % 3 === 0;
      const fixed = sign % 3 === 1;
      const start = movable ? 0 : fixed ? 4 : 8;
      return (start + p) % 12;
    }
    case 'D60':
      return (sign + (part(60) % 12)) % 12;
    default:
      return sign;
  }
}

export interface VargaChart {
  id: VargaId;
  ascSign: number;
  planets: Record<PlanetKey, number>; // planet → sign index
}

export function buildVargas(
  ascLon: number,
  planets: Record<PlanetKey, { lon: number }>,
  ids: VargaId[] = [...VARGA_LIST],
): Record<VargaId, VargaChart> {
  const out = {} as Record<VargaId, VargaChart>;
  for (const id of ids) {
    const p = {} as Record<PlanetKey, number>;
    for (const key of Object.keys(planets) as PlanetKey[]) {
      p[key] = vargaSign(planets[key].lon, id);
    }
    out[id] = { id, ascSign: vargaSign(ascLon, id), planets: p };
  }
  return out;
}

export const signName = (i: number) => SIGNS[((i % 12) + 12) % 12];
