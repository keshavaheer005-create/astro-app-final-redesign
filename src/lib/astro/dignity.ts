// ─── Classical sign dignity (graha maitri + exaltation/own/debilitation) ────
//
// Sign-level dignity used for varga tables (D9 first). Traditional sources:
// exaltation/own signs per BPHS; natural friendship (naisargika maitri) per
// BPHS ch. 3 — used when the planet occupies a sign owned by another.
// Nodes (Ra/Ke) are chordless in most classical dignity schemes → null.

import type { PlanetKey } from './constants';

export type Dignity = 'exalted' | 'debilitated' | 'own' | 'friendly' | 'enemy' | 'neutral';

/** 0-based sidereal sign of each planet's exaltation. */
const EXALTED: Partial<Record<PlanetKey, number>> = {
  Su: 0, // Aries
  Mo: 1, // Taurus
  Ma: 9, // Capricorn
  Me: 5, // Virgo
  Ju: 3, // Cancer
  Ve: 11, // Pisces
  Sa: 6, // Libra
};

/** 0-based sidereal signs each planet owns. */
const OWNED: Partial<Record<PlanetKey, number[]>> = {
  Su: [4], // Leo
  Mo: [3], // Cancer
  Ma: [0, 7], // Aries, Scorpio
  Me: [2, 5], // Gemini, Virgo
  Ju: [8, 11], // Sagittarius, Pisces
  Ve: [1, 6], // Taurus, Libra
  Sa: [9, 10], // Capricorn, Aquarius
};

/** Sign lords (0 = Mesha … 11 = Meena); same 7 grahas own the 12 signs. */
const SIGN_LORD: PlanetKey[] = ['Ma', 'Ve', 'Me', 'Mo', 'Su', 'Me', 'Ve', 'Ma', 'Ju', 'Sa', 'Sa', 'Ju'];

/** Natural friendship groups: friends / enemies per planet (rest neutral). */
const FRIENDS: Partial<Record<PlanetKey, PlanetKey[]>> = {
  Su: ['Mo', 'Ma', 'Ju'],
  Mo: ['Su', 'Me'],
  Ma: ['Su', 'Mo', 'Ju'],
  Me: ['Su', 'Ve'],
  Ju: ['Su', 'Mo', 'Ma'],
  Ve: ['Me', 'Sa'],
  Sa: ['Me', 'Ve'],
};
const ENEMIES: Partial<Record<PlanetKey, PlanetKey[]>> = {
  Su: ['Ve', 'Sa'],
  Mo: [],
  Ma: ['Me'],
  Me: ['Mo'],
  Ju: ['Me', 'Ve'],
  Ve: ['Su', 'Mo'],
  Sa: ['Su', 'Mo'],
};

/**
 * Dignity of `pk` occupying 0-based `sign` (works for any varga where only
 * the sign matters). Returns null for the nodes (no classical ownership).
 */
export function dignityOf(pk: PlanetKey, sign: number): Dignity | null {
  if (pk === 'Ra' || pk === 'Ke') return null;
  const ex = EXALTED[pk];
  if (ex === sign) return 'exalted';
  if (ex !== undefined && (ex + 6) % 12 === sign) return 'debilitated';
  if ((OWNED[pk] ?? []).includes(sign)) return 'own';
  const lord = SIGN_LORD[sign];
  if (lord === pk) return 'own'; // defensive; OWNED covers this
  if ((FRIENDS[pk] ?? []).includes(lord)) return 'friendly';
  if ((ENEMIES[pk] ?? []).includes(lord)) return 'enemy';
  return 'neutral';
}
