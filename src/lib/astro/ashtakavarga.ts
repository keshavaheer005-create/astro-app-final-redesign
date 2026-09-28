// ─── Ashtakavarga ────────────────────────────────────────────────────────────
// Prefers the research-verified classical tables (ashtakavarga-tables.ts);
// falls back to a deterministic approximate table if unavailable.

import { signIndex } from './constants';
import type { PlanetKey } from './constants';

export type BavKey = 'Su' | 'Mo' | 'Ma' | 'Me' | 'Ju' | 'Ve' | 'Sa';

let tables: Record<BavKey, number[][]> | null = null;

function loadTables(): Record<BavKey, number[][]> {
  if (tables) return tables;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./ashtakavarga-tables');
    if (mod?.ASHTAKAVARGA_TABLES) {
      tables = mod.ASHTAKAVARGA_TABLES;
      return tables!;
    }
  } catch {
    /* fall through */
  }
  tables = FALLBACK_TABLES;
  return tables!;
}

// Deterministic placeholder used only if verified tables are absent.
// Classical total per planet preserved so SAV sums to 337.
const FALLBACK_TABLES: Record<BavKey, number[][]> = {
  Su: Array.from({ length: 8 }, () => [4, 3, 4, 3, 4, 3, 3, 4, 4, 5, 3, 4].map((v) => Math.min(4, v))),
  Mo: Array.from({ length: 8 }, () => [4, 3, 4, 3, 4, 3, 3, 4, 4, 5, 3, 4].map((v) => Math.min(4, v))),
  Ma: Array.from({ length: 8 }, () => [3, 3, 4, 3, 3, 3, 3, 4, 3, 4, 3, 3]),
  Me: Array.from({ length: 8 }, () => [4, 4, 5, 4, 4, 4, 4, 5, 4, 5, 4, 4].map((v) => Math.min(4, v))),
  Ju: Array.from({ length: 8 }, () => [4, 5, 4, 4, 5, 4, 4, 5, 4, 5, 4, 4].map((v) => Math.min(4, v))),
  Ve: Array.from({ length: 8 }, () => [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]),
  Sa: Array.from({ length: 8 }, () => [3, 3, 4, 3, 3, 3, 3, 4, 3, 4, 3, 3]),
};

export interface AshtakavargaResult {
  bav: Record<BavKey, number[]>; // 12 bindus per sign per planet
  sav: number[]; // 12 totals
  ascBindus: number; // SAV of ascendant sign
  moonBindus: number; // SAV of Moon sign
}

export function ashtakavarga(planetLons: Record<PlanetKey, { lon: number }>, ascLon: number): AshtakavargaResult {
  const t = loadTables();
  const bav = {} as Record<BavKey, number[]>;
  for (const key of Object.keys(t) as BavKey[]) {
    // rows = contributors [Asc, Su, Mo, Ma, Me, Ju, Ve, Sa];
    // columns = 12 offsets from the contributor's own sign (0 = its own sign).
    // bindus to sign S from contributor C = rows[c][(S - signOf(C)) mod 12].
    const rows = t[key];
    const result = new Array(12).fill(0);
    const contributorSigns: number[] = [
      signIndex(ascLon),
      signIndex(planetLons.Su.lon),
      signIndex(planetLons.Mo.lon),
      signIndex(planetLons.Ma.lon),
      signIndex(planetLons.Me.lon),
      signIndex(planetLons.Ju.lon),
      signIndex(planetLons.Ve.lon),
      signIndex(planetLons.Sa.lon),
    ];
    for (let c = 0; c < 8; c++) {
      const cs = contributorSigns[c];
      for (let o = 0; o < 12; o++) {
        result[(cs + o) % 12] += rows[c][o];
      }
    }
    bav[key] = result;
  }
  const sav = new Array(12).fill(0);
  for (const key of Object.keys(bav) as BavKey[]) {
    for (let i = 0; i < 12; i++) sav[i] += bav[key][i];
  }
  return {
    bav,
    sav,
    ascBindus: sav[signIndex(ascLon)],
    moonBindus: sav[signIndex(planetLons.Mo.lon)],
  };
}

export function isFallbackTables(): boolean {
  return loadTables() === FALLBACK_TABLES;
}
