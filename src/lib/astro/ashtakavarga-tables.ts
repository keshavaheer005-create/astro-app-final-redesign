// Classical Ashtakavarga (Bhinnashtakavarga) benefic-points (bindu) tables.
//
// Each planet's table is the FIXED sign-wise grid: rows = the 8 reference bodies
// [Ascendant, Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn], columns = the 12
// rashis Aries..Pisces (index 0..11). A cell holds the number of benefic bindus
// (rekhas) that the row-body contributes to that rashi — classically 1 or 0
// (a reference body gives at most one bindu to a given sign).
//
// The grids are derived from the classical benefic-place rules (houses 1-12 from
// each reference body) applied in the natural zodiac (Sun-Leo, Moon-Cancer,
// Mars-Aries, Mercury-Gemini, Jupiter-Sagittarius, Venus-Libra, Saturn-Capricorn,
// Lagna-Aries). The rules are reproduced in BENEFIC_HOUSES below and re-checked
// against the grids at module load (assertAshtakavargaTables).
//
// Verified against the following sources (all agree on every row used here):
//  1. B.V. Raman, "Ashtakavarga System of Prediction", Ch. II — benefic-place
//     tables + worked example on the Standard Horoscope (Bangalore, 16 Oct 1918):
//     all seven BAVs and the SAV recompute exactly as published (Charts 9-16).
//     Systematically transcribed at https://vedastro.org/blog/Mastering-Ashtakavarga-Part-2-Building-Bhinnashtakavarga-Charts.html
//  2. https://github.com/northtara/jyotishganit — jyotishganit/components/ashtakavarga.py (BPHS benefic-house tables)
//  3. https://github.com/SanjayPrabhakaran/srijagannatha-panchanga — SJPv6/www/SJPashtakavarga.htm
//  4. @node-jhora/analytics (npm) — dist/ashtakavarga/rules.js ("BPHS Standard")
//  5. https://github.com/prisriorg/jyotish — src/ashtakavarga/constants.ts
//  6. https://saravali.github.io/astrology/av_rekha.html (Saravali software rekha relations)
//
// Classical planet totals (constant for every horoscope):
//   Sun 48, Moon 49, Mars 39, Mercury 54, Jupiter 56, Venus 52, Saturn 39 (sum 337).

export type AshtakavargaPlanet = 'Su' | 'Mo' | 'Ma' | 'Me' | 'Ju' | 'Ve' | 'Sa';

export const CONTRIBUTOR_ORDER = ['Asc', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'] as const;
export const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

export const ASHTAKAVARGA_PLANET_TOTALS: Record<AshtakavargaPlanet, number> = {
  Su: 48, Mo: 49, Ma: 39, Me: 54, Ju: 56, Ve: 52, Sa: 39,
};
export const TOTAL_BINDUS = 337;

// rows: contributors in order [Asc, Su, Mo, Ma, Me, Ju, Ve, Sa]
// columns: signs in order Aries..Pisces (index 0..11)
export const ASHTAKAVARGA_TABLES: Record<AshtakavargaPlanet, number[][]> = {
  // Sun — total 48
  Su: [
    [0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1], // Asc
    [1, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1], // Su
    [1, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0], // Mo
    [1, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, 0], // Ma
    [1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1], // Me
    [1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0], // Ju
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1], // Ve
    [1, 0, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0], // Sa
  ],
  // Moon — total 49
  Mo: [
    [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0], // Asc
    [0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 1], // Su
    [1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0], // Mo
    [0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0], // Ma
    [1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1], // Me
    [0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1], // Ju
    [1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0], // Ve
    [0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1], // Sa
  ],
  // Mars — total 39
  Ma: [
    [1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0], // Asc
    [0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0], // Su
    [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0], // Mo
    [1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0], // Ma
    [1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0], // Me
    [0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0], // Ju
    [0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1], // Ve
    [1, 0, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0], // Sa
  ],
  // Mercury — total 54
  Me: [
    [1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0], // Asc
    [1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0], // Su
    [1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0], // Mo
    [1, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, 0], // Ma
    [1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1], // Me
    [0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0], // Ju
    [0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0], // Ve
    [1, 0, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0], // Sa
  ],
  // Jupiter — total 56
  Ju: [
    [1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0], // Asc
    [1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1], // Su
    [0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1], // Mo
    [1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0], // Ma
    [1, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1], // Me
    [0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1], // Ju
    [0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1], // Ve
    [0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1], // Sa
  ],
  // Venus — total 52
  Ve: [
    [1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0], // Asc
    [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1], // Su
    [0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1], // Mo
    [0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1], // Ma
    [1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0], // Me
    [1, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0], // Ju
    [0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0], // Ve
    [1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1], // Sa
  ],
  // Saturn — total 39
  Sa: [
    [1, 0, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0], // Asc
    [0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1], // Su
    [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0], // Mo
    [0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1], // Ma
    [1, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1], // Me
    [1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0], // Ju
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1], // Ve
    [0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1], // Sa
  ],
};

// Classical benefic-place rules (BPHS / B.V. Raman): for each planet, the houses
// (1-12) counted from each reference body that receive a benefic bindu.
// Contributor index: 0=Asc, 1=Su, 2=Mo, 3=Ma, 4=Me, 5=Ju, 6=Ve, 7=Sa
// (same order as CONTRIBUTOR_ORDER / table rows).
export const BENEFIC_HOUSES: Record<AshtakavargaPlanet, number[][]> = {
  Su: [
    [3, 4, 6, 10, 11, 12],
    [1, 2, 4, 7, 8, 9, 10, 11],
    [3, 6, 10, 11],
    [1, 2, 4, 7, 8, 9, 10, 11],
    [3, 5, 6, 9, 10, 11, 12],
    [5, 6, 9, 11],
    [6, 7, 12],
    [1, 2, 4, 7, 8, 9, 10, 11],
  ],
  Mo: [
    [3, 6, 10, 11],
    [3, 6, 7, 8, 10, 11],
    [1, 3, 6, 7, 10, 11],
    [2, 3, 5, 6, 9, 10, 11],
    [1, 3, 4, 5, 7, 8, 10, 11],
    [1, 4, 7, 8, 10, 11, 12],
    [3, 4, 5, 7, 9, 10, 11],
    [3, 5, 6, 11],
  ],
  Ma: [
    [1, 3, 6, 10, 11],
    [3, 5, 6, 10, 11],
    [3, 6, 11],
    [1, 2, 4, 7, 8, 10, 11],
    [3, 5, 6, 11],
    [6, 10, 11, 12],
    [6, 8, 11, 12],
    [1, 4, 7, 8, 9, 10, 11],
  ],
  Me: [
    [1, 2, 4, 6, 8, 10, 11],
    [5, 6, 9, 11, 12],
    [2, 4, 6, 8, 10, 11],
    [1, 2, 4, 7, 8, 9, 10, 11],
    [1, 3, 5, 6, 9, 10, 11, 12],
    [6, 8, 11, 12],
    [1, 2, 3, 4, 5, 8, 9, 11],
    [1, 2, 4, 7, 8, 9, 10, 11],
  ],
  Ju: [
    [1, 2, 4, 5, 6, 7, 9, 10, 11],
    [1, 2, 3, 4, 7, 8, 9, 10, 11],
    [2, 5, 7, 9, 11],
    [1, 2, 4, 7, 8, 10, 11],
    [1, 2, 4, 5, 6, 9, 10, 11],
    [1, 2, 3, 4, 7, 8, 10, 11],
    [2, 5, 6, 9, 10, 11],
    [3, 5, 6, 12],
  ],
  Ve: [
    [1, 2, 3, 4, 5, 8, 9, 11],
    [8, 11, 12],
    [1, 2, 3, 4, 5, 8, 9, 11, 12],
    [3, 5, 6, 9, 11, 12],
    [3, 5, 6, 9, 11],
    [5, 8, 9, 10, 11],
    [1, 2, 3, 4, 5, 8, 9, 10, 11],
    [3, 4, 5, 8, 9, 10, 11],
  ],
  Sa: [
    [1, 3, 4, 6, 10, 11],
    [1, 2, 4, 7, 8, 10, 11],
    [3, 6, 11],
    [3, 5, 6, 10, 11, 12],
    [6, 8, 9, 10, 11, 12],
    [5, 6, 11, 12],
    [6, 11, 12],
    [3, 5, 6, 11],
  ],
};

// Natural-zodiac sign of each reference body (used to derive the fixed grid
// from BENEFIC_HOUSES): Asc/Aries=0, Sun/Leo=4, Moon/Cancer=3, Mars/Aries=0,
// Mercury/Gemini=2, Jupiter/Sagittarius=8, Venus/Libra=6, Saturn/Capricorn=9.
export const NATURAL_SIGNS: number[] = [0, 4, 3, 0, 2, 8, 6, 9];

const PLANETS: AshtakavargaPlanet[] = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'];

/**
 * Sarvashtakavarga: per-sign totals computed as the sum of the seven planetary
 * Bhinnashtakavarga rows (NOT hardcoded, always consistent with the tables).
 */
export function sarvashtakavarga(): number[] {
  const totals = new Array<number>(12).fill(0);
  for (const planet of PLANETS) {
    const table = ASHTAKAVARGA_TABLES[planet];
    for (const row of table) {
      for (let sign = 0; sign < 12; sign++) {
        totals[sign] += row[sign];
      }
    }
  }
  return totals;
}

/** Bhinnashtakavarga per-sign bindus for one planet (sum of its 8 contributor rows). */
export function bhinnashtakavarga(planet: AshtakavargaPlanet): number[] {
  return ASHTAKAVARGA_TABLES[planet].reduce(
    (acc, row) => acc.map((v, i) => v + row[i]),
    new Array<number>(12).fill(0),
  );
}

/**
 * Validation — throws if the tables are malformed or internally inconsistent:
 *  - 8 rows x 12 columns, every cell an integer 0..4
 *  - each planet's grand total equals its classical constant (48/49/39/54/56/52/39)
 *  - each grid exactly matches the grid recomputed from BENEFIC_HOUSES rules
 *    applied in the natural zodiac
 *  - SAV grand total = 337
 */
export function assertAshtakavargaTables(): void {
  for (const planet of PLANETS) {
    const table = ASHTAKAVARGA_TABLES[planet];
    if (!Array.isArray(table) || table.length !== 8) {
      throw new Error(`Ashtakavarga table '${planet}' must have 8 contributor rows`);
    }
    let total = 0;
    for (const row of table) {
      if (!Array.isArray(row) || row.length !== 12) {
        throw new Error(`Ashtakavarga table '${planet}' row must have 12 sign columns`);
      }
      for (const cell of row) {
        if (!Number.isInteger(cell) || cell < 0 || cell > 4) {
          throw new Error(`Ashtakavarga table '${planet}' has out-of-range cell ${cell}`);
        }
        total += cell;
      }
    }
    if (total !== ASHTAKAVARGA_PLANET_TOTALS[planet]) {
      throw new Error(
        `Ashtakavarga table '${planet}' total ${total} != classical ${ASHTAKAVARGA_PLANET_TOTALS[planet]}`,
      );
    }
    // Re-derive the fixed grid from the house rules and compare.
    const derived: number[][] = Array.from({ length: 8 }, () => new Array<number>(12).fill(0));
    CONTRIBUTOR_ORDER.forEach((_, ci) => {
      for (const house of BENEFIC_HOUSES[planet][ci]) {
        derived[ci][(NATURAL_SIGNS[ci] + house - 1) % 12] += 1;
      }
    });
    for (let r = 0; r < 8; r++) {
      for (let s = 0; s < 12; s++) {
        if (derived[r][s] !== table[r][s]) {
          throw new Error(
            `Ashtakavarga table '${planet}' cell [row ${r}, sign ${s}] = ${table[r][s]} but rules give ${derived[r][s]}`,
          );
        }
      }
    }
  }
  const sav = sarvashtakavarga();
  if (sav.reduce((a, b) => a + b, 0) !== TOTAL_BINDUS) {
    throw new Error('Sarvashtakavarga grand total != 337');
  }
}

assertAshtakavargaTables();
