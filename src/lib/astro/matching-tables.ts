// ─── Kundli matching lookup tables ──────────────────────────────────────────
// Classical Ashtakoota tables. Yoni matrix follows the widely published
// BPHS-derived compatibility chart (4 = same yoni … 0 = sworn enemy).

export const NAKSHATRA_YONI: string[] = [
  'Horse', 'Elephant', 'Sheep', 'Serpent', 'Serpent', 'Dog',
  'Cat', 'Sheep', 'Cat', 'Rat', 'Rat', 'Cow',
  'Buffalo', 'Tiger', 'Buffalo', 'Tiger', 'Deer', 'Deer',
  'Dog', 'Monkey', 'Mongoose', 'Monkey', 'Lion', 'Horse',
  'Lion', 'Cow', 'Elephant',
];

export const YONI_NAMES: string[] = [
  'Horse', 'Elephant', 'Sheep', 'Serpent', 'Dog', 'Cat',
  'Rat', 'Cow', 'Buffalo', 'Tiger', 'Deer', 'Monkey',
  'Mongoose', 'Lion',
];

// rows/cols indexed by YONI_NAMES order. Symmetric.
// NOTE: Cat–Tiger is 2 (published charts say 1) because AstroSage scores that
// pair 2 (verified on a real match: Punarvasu/Vishakha). Add further AstroSage
// deviations here as they are observed. 4 = same yoni,
// 0 = sworn enemies (Cow–Tiger, Elephant–Lion, Horse–Buffalo, Dog–Deer,
// Cat–Rat, Serpent–Mongoose, Sheep–Monkey). Cross-checked against Saravali,
// Jagannatha Hora and published Ashtakoota charts.
export const YONI_MATRIX: number[][] = [
  // Ho El Sh Se Do Ca Ra Co Bu Ti De Mk Mg Li
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1], // Horse
  [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0], // Elephant
  [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1], // Sheep
  [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2], // Serpent
  [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1], // Dog
  [2, 2, 2, 1, 2, 4, 0, 2, 2, 2, 3, 3, 2, 1], // Cat
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2], // Rat
  [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1], // Cow
  [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1], // Buffalo
  [1, 1, 1, 2, 1, 2, 2, 0, 1, 4, 1, 1, 2, 1], // Tiger
  [3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 2], // Deer
  [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2], // Monkey
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2], // Mongoose
  [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 2, 2, 2, 4], // Lion
];

// Vashya groups. Sagittarius and Capricorn are split at 15° (see vashyaGroup()).
export type VashyaGroup = 'Chatushpada' | 'Manava' | 'Jalachara' | 'Vanachara' | 'Keeta';
export const VASHYA_GROUPS: VashyaGroup[] = ['Chatushpada', 'Manava', 'Jalachara', 'Vanachara', 'Keeta'];

/** Group for a Moon sign (0-11) at a degree within the sign (0-30). */
export function vashyaGroup(sign: number, degInSign: number): VashyaGroup {
  switch (sign) {
    case 0: case 1: return 'Chatushpada';            // Aries, Taurus
    case 2: case 5: case 6: case 10: return 'Manava'; // Gemini, Virgo, Libra, Aquarius
    case 3: case 11: return 'Jalachara';             // Cancer, Pisces
    case 4: return 'Vanachara';                      // Leo
    case 7: return 'Keeta';                          // Scorpio
    case 8: return degInSign < 15 ? 'Manava' : 'Chatushpada';   // Sagittarius
    case 9: return degInSign < 15 ? 'Chatushpada' : 'Jalachara'; // Capricorn
    default: return 'Manava';
  }
}

// rows = BRIDE group, cols = GROOM group (order of VASHYA_GROUPS).
// Values follow AstroSage: verified Jalachara(groom)/Manava(bride) = 0.5
// (some published charts say 1.5). Chatushpada/Vanachara uses the same 0.5
// variant (inferred, not yet observed on AstroSage).
export const VASHYA_MATRIX: number[][] = [
  //  Ch   Ma   Ja   Va   Ke
  [2, 1, 1, 0.5, 1],   // Chatushpada
  [1, 2, 0.5, 0, 1],   // Manava
  [1, 0.5, 2, 1, 1],   // Jalachara
  [0, 0, 0, 2, 0],     // Vanachara
  [1, 1, 1, 0, 2],     // Keeta
];

export const NAKSHATRA_GANA: ('Deva' | 'Manushya' | 'Rakshasa')[] = [
  'Deva', 'Manushya', 'Rakshasa', 'Manushya', 'Deva', 'Manushya',
  'Deva', 'Deva', 'Rakshasa', 'Rakshasa', 'Manushya', 'Manushya',
  'Deva', 'Rakshasa', 'Deva', 'Rakshasa', 'Deva', 'Rakshasa',
  'Rakshasa', 'Manushya', 'Manushya', 'Deva', 'Rakshasa', 'Rakshasa',
  'Manushya', 'Manushya', 'Deva',
];

// Gana points [boy][girl]. AstroSage verified: Deva/Rakshasa = 0 and
// Manushya/Rakshasa = 0 (boy/girl). Deva/Manushya asymmetry (6 vs 5) follows the
// widely published table and is NOT yet verified against AstroSage.
export const GANA_MATRIX: Record<'Deva' | 'Manushya' | 'Rakshasa', Record<'Deva' | 'Manushya' | 'Rakshasa', number>> = {
  Deva:     { Deva: 6, Manushya: 6, Rakshasa: 0 },
  Manushya: { Deva: 5, Manushya: 6, Rakshasa: 0 },
  Rakshasa: { Deva: 0, Manushya: 0, Rakshasa: 6 },
};

export const NAKSHATRA_NADI: ('Adi' | 'Madhya' | 'Antya')[] = [
  'Adi', 'Madhya', 'Antya', 'Antya', 'Madhya', 'Adi',
  'Adi', 'Madhya', 'Antya', 'Antya', 'Madhya', 'Adi',
  'Adi', 'Madhya', 'Antya', 'Antya', 'Madhya', 'Adi',
  'Adi', 'Madhya', 'Antya', 'Antya', 'Madhya', 'Adi',
  'Adi', 'Madhya', 'Antya',
];

export const SIGN_VARNA: string[] = [
  'Kshatriya', 'Vaishya', 'Shudra', 'Brahmin', 'Kshatriya', 'Vaishya',
  'Shudra', 'Brahmin', 'Kshatriya', 'Vaishya', 'Shudra', 'Brahmin',
];

// ── Dashakoota (South Indian) tables ────────────────────────────────────────
// Rajju: five body-limb groups, 1-based nakshatra numbers (Ashwini = 1).
// Confirmed by multiple Tamil/Jyotish sources; same limb for both = Rajju dosha.
export type RajjuGroup = 'Paada' | 'Kati' | 'Udara' | 'Kantha' | 'Siro';
const RAJJU_NUMBERS: Record<RajjuGroup, number[]> = {
  Paada: [1, 9, 10, 18, 19, 27],
  Kati: [2, 8, 11, 17, 20, 26],
  Udara: [3, 7, 12, 16, 21, 25],
  Kantha: [4, 6, 13, 15, 22, 24],
  Siro: [5, 14, 23],
};
export const NAKSHATRA_RAJJU: RajjuGroup[] = (() => {
  const out: RajjuGroup[] = new Array(27);
  (Object.keys(RAJJU_NUMBERS) as RajjuGroup[]).forEach((g) => RAJJU_NUMBERS[g].forEach((n) => { out[n - 1] = g; }));
  return out;
})();

// Vedha: 13 classical obstructing pairs (1-based nakshatra numbers).
export const VEDHA_PAIRS: [number, number][] = [
  [1, 18], [2, 17], [3, 16], [4, 15], [6, 22], [7, 21], [8, 20],
  [9, 19], [10, 27], [11, 26], [12, 25], [13, 24], [14, 23],
];

// module-level validation
if (
  NAKSHATRA_YONI.length !== 27 || YONI_NAMES.length !== 14 ||
  YONI_MATRIX.length !== 14 || VASHYA_MATRIX.length !== 5 ||
  NAKSHATRA_GANA.length !== 27 || NAKSHATRA_NADI.length !== 27 || SIGN_VARNA.length !== 12
) {
  throw new Error('matching-tables.ts: array length validation failed');
}
for (let i = 0; i < 14; i++) {
  if (YONI_MATRIX[i].length !== 14 || YONI_MATRIX[i][i] !== 4) {
    throw new Error(`matching-tables.ts: YONI_MATRIX row ${i} invalid`);
  }
  for (let j = 0; j < 14; j++) {
    if (YONI_MATRIX[i][j] !== YONI_MATRIX[j][i]) {
      throw new Error(`matching-tables.ts: YONI_MATRIX not symmetric at ${i},${j}`);
    }
  }
}
if (NAKSHATRA_RAJJU.some((g) => !g) || NAKSHATRA_RAJJU.length !== 27) {
  throw new Error('matching-tables.ts: NAKSHATRA_RAJJU incomplete');
}
