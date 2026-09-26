// Fallback tables used only until the research-verified matching-tables.ts lands.
import type { PlanetKey } from './constants';

export const SIGN_VARNA_FALLBACK: string[] = [
  'Kshatriya', 'Vaishya', 'Shudra', 'Brahmin', 'Kshatriya', 'Vaishya',
  'Shudra', 'Brahmin', 'Kshatriya', 'Vaishya', 'Shudra', 'Brahmin',
];

// 14 yonis; nakshatra → yoni
export const YONI_FALLBACK: { NAKSHATRA_YONI: string[]; YONI_NAMES: string[]; YONI_MATRIX: number[][] } = {
  NAKSHATRA_YONI: [
    'Horse', 'Elephant', 'Sheep', 'Serpent', 'Serpent', 'Dog',
    'Cat', 'Sheep', 'Cat', 'Rat', 'Rat', 'Cow',
    'Buffalo', 'Tiger', 'Buffalo', 'Tiger', 'Deer', 'Deer',
    'Dog', 'Monkey', 'Mongoose', 'Monkey', 'Lion', 'Horse',
    'Lion', 'Cow', 'Elephant',
  ],
  YONI_NAMES: ['Horse', 'Elephant', 'Sheep', 'Serpent', 'Dog', 'Cat', 'Rat', 'Cow', 'Buffalo', 'Tiger', 'Deer', 'Monkey', 'Mongoose', 'Lion'],
  // Standard published yoni compatibility matrix (4 = same yoni, 0 = sworn enemy)
  YONI_MATRIX: [
    // Ho  El  Sh  Se  Do  Ca  Ra  Co  Bu  Ti  De  Mk  Mg  Li
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
  ],
};

export const VASHYA_FALLBACK: { SIGN_VASHYA: string[]; VASYA_MAP: number[][] } = {
  SIGN_VASHYA: [
    'Chatushpada', 'Chatushpada', 'Manava', 'Jalachara', 'Chatushpada', 'Manava',
    'Manava', 'Keeta', 'Manava', 'Jalachara', 'Manava', 'Jalachara',
  ],
  VASYA_MAP: [
    [4, 7], [3, 6], [5], [7, 8], [6], [11, 2], [9, 5], [3], [11], [0, 10], [0], [9],
  ],
};

export const NAKSHATRA_GANA_FALLBACK: string[] = [
  'Deva', 'Manushya', 'Rakshasa', 'Manushya', 'Deva', 'Manushya',
  'Deva', 'Deva', 'Rakshasa', 'Rakshasa', 'Manushya', 'Manushya',
  'Deva', 'Rakshasa', 'Deva', 'Rakshasa', 'Deva', 'Rakshasa',
  'Rakshasa', 'Manushya', 'Manushya', 'Deva', 'Rakshasa', 'Rakshasa',
  'Manushya', 'Manushya', 'Deva',
];

export const NAKSHATRA_NADI_FALLBACK: string[] = [
  'Adi', 'Madhya', 'Antya', 'Antya', 'Madhya', 'Adi',
  'Adi', 'Madhya', 'Antya', 'Antya', 'Madhya', 'Adi',
  'Adi', 'Madhya', 'Antya', 'Antya', 'Madhya', 'Adi',
  'Adi', 'Madhya', 'Antya', 'Antya', 'Madhya', 'Adi',
  'Adi', 'Madhya', 'Antya',
];

export type { PlanetKey };
