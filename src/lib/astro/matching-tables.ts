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

// rows/cols indexed by YONI_NAMES order
export const YONI_MATRIX: number[][] = [
  // Ho El Sh Se Do Ca Ra Co Bu Ti De Mk Mg Li
  [4, 2, 3, 2, 1, 2, 1, 3, 3, 1, 3, 2, 1, 1], // Horse
  [2, 4, 3, 1, 1, 1, 2, 3, 2, 1, 2, 3, 0, 2], // Elephant
  [3, 3, 4, 2, 2, 1, 3, 3, 3, 1, 3, 2, 1, 2], // Sheep
  [2, 1, 2, 4, 1, 3, 1, 2, 1, 2, 1, 1, 1, 1], // Serpent
  [1, 1, 2, 1, 4, 1, 1, 1, 2, 1, 2, 1, 2, 2], // Dog
  [2, 1, 1, 3, 1, 4, 1, 1, 2, 1, 2, 2, 1, 1], // Cat
  [1, 2, 3, 1, 1, 1, 4, 2, 2, 1, 2, 1, 2, 0], // Rat
  [3, 3, 3, 2, 1, 1, 2, 4, 3, 0, 3, 2, 1, 2], // Cow
  [3, 2, 3, 1, 2, 2, 2, 3, 4, 1, 3, 2, 1, 1], // Buffalo
  [1, 1, 1, 2, 1, 1, 1, 0, 1, 4, 1, 1, 1, 1], // Tiger
  [3, 2, 3, 1, 2, 2, 2, 3, 3, 1, 4, 2, 1, 2], // Deer
  [2, 3, 2, 1, 1, 2, 1, 2, 2, 1, 2, 4, 2, 2], // Monkey
  [1, 0, 1, 1, 2, 1, 2, 1, 1, 1, 1, 2, 4, 2], // Mongoose
  [1, 2, 2, 1, 2, 1, 0, 2, 1, 1, 2, 2, 2, 4], // Lion
];

export const SIGN_VASHYA: string[] = [
  'Chatushpada', 'Chatushpada', 'Manava', 'Jalachara', 'Chatushpada', 'Manava',
  'Manava', 'Keeta', 'Manava', 'Jalachara', 'Manava', 'Jalachara',
];

export const VASYA_MAP: number[][] = [
  [4, 7], [3, 6], [5], [7, 8], [6], [11, 2],
  [9, 5], [3], [11], [0, 10], [0], [9],
];

export const NAKSHATRA_GANA: ('Deva' | 'Manushya' | 'Rakshasa')[] = [
  'Deva', 'Manushya', 'Rakshasa', 'Manushya', 'Deva', 'Manushya',
  'Deva', 'Deva', 'Rakshasa', 'Rakshasa', 'Manushya', 'Manushya',
  'Deva', 'Rakshasa', 'Deva', 'Rakshasa', 'Deva', 'Rakshasa',
  'Rakshasa', 'Manushya', 'Manushya', 'Deva', 'Rakshasa', 'Rakshasa',
  'Manushya', 'Manushya', 'Deva',
];

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

// module-level validation
if (
  NAKSHATRA_YONI.length !== 27 || YONI_NAMES.length !== 14 ||
  YONI_MATRIX.length !== 14 || SIGN_VASHYA.length !== 12 ||
  VASYA_MAP.length !== 12 || NAKSHATRA_GANA.length !== 27 ||
  NAKSHATRA_NADI.length !== 27 || SIGN_VARNA.length !== 12
) {
  throw new Error('matching-tables.ts: array length validation failed');
}
for (let i = 0; i < 14; i++) {
  if (YONI_MATRIX[i].length !== 14 || YONI_MATRIX[i][i] !== 4) {
    throw new Error(`matching-tables.ts: YONI_MATRIX row ${i} invalid`);
  }
}
