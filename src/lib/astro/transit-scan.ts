/**
 * Sign-ingress scanning ("when does Saturn change sign?").
 *
 * The transit board answers *where* the grahas are now. This module answers
 * *when the next shift happens* for the slow grahas, which is what makes a
 * timeline useful: "Saturn enters Pisces on 2027-03-29".
 *
 * The scan is deliberately transport-agnostic: it takes a `positionAt(date)`
 * callback, so it can be unit-tested against synthetic motion without loading
 * the native Swiss Ephemeris. The API route supplies the real callback.
 *
 * Algorithm: walk forward in coarse steps until the sign differs from the start
 * sign, then bisect day-by-day inside that bracket to find the first day of the
 * new sign. Retrograde loops are handled naturally — the first crossing wins.
 */
import type { PlanetKey } from './constants';

export const DAY_MS = 86_400_000;

export type PositionAt = (date: Date) => number;
export type SignOf = (longitude: number) => number;

export interface Ingress {
  key: PlanetKey;
  /** 0-11 sign index the planet is entering. */
  intoSign: number;
  /** `YYYY-MM-DD` (UTC day). */
  at: string;
  daysUntil: number;
}

export interface IngressSpec {
  key: PlanetKey;
  /** How far ahead to search, in days. */
  windowDays: number;
  positionAt: PositionAt;
  /**
   * Coarse step for the first pass. Must stay well below the shortest time a
   * planet needs to cross a sign (Saturn ~2.5y, Jupiter ~1y, Rahu ~1.5y), so a
   * slow graha can use a wide step and a cheap scan.
   */
  coarseDays?: number;
}

/** Default coarse step. Slow grahas cannot cross a sign inside 10 days. */
const COARSE_DAYS = 10;

function safePosition(positionAt: PositionAt, date: Date): number | null {
  try {
    const lon = positionAt(date);
    return Number.isFinite(lon) ? lon : null;
  } catch {
    return null;
  }
}

/**
 * First date on which `signOf(positionAt(date))` differs from the sign at
 * `from`. Returns `null` when nothing changes within `maxDays` (or when the
 * position function fails).
 */
export function nextIngress(
  positionAt: PositionAt,
  signOf: SignOf,
  from: Date,
  maxDays: number,
  coarseDays: number = COARSE_DAYS,
): Date | null {
  const startLon = safePosition(positionAt, from);
  if (startLon === null) return null;
  const startSign = signOf(startLon);
  const stride = Math.max(1, Math.floor(coarseDays));

  const step = (days: number) => new Date(from.getTime() + days * DAY_MS);
  const changed = (days: number): boolean | null => {
    const lon = safePosition(positionAt, step(days));
    if (lon === null) return null;
    return signOf(lon) !== startSign;
  };

  // Coarse pass: find the first bracket where the sign already changed.
  let lo = 0;
  let hi = -1;
  for (let d = stride; d <= maxDays; d += stride) {
    const hit = changed(d);
    if (hit === null) return null;
    if (hit) {
      hi = d;
      lo = d - stride;
      break;
    }
    lo = d;
  }
  // The window may not be a multiple of the coarse step.
  if (hi < 0 && maxDays > lo) {
    const hit = changed(maxDays);
    if (hit === null) return null;
    if (hit) hi = maxDays;
  }
  if (hi < 0) return null;

  // Bisect day-by-day for the first day of the new sign.
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const hit = changed(mid);
    if (hit === null) return null;
    if (hit) hi = mid;
    else lo = mid;
  }
  return step(hi);
}

/**
 * Ingresses for a set of planets, sorted by date. Planets without a change in
 * their window are omitted.
 */
export function scanIngresses(specs: readonly IngressSpec[], signOf: SignOf, from: Date): Ingress[] {
  const now = from.getTime();
  const out: Ingress[] = [];
  for (const spec of specs) {
    const when = nextIngress(spec.positionAt, signOf, from, spec.windowDays, spec.coarseDays);
    if (!when) continue;
    const lon = safePosition(spec.positionAt, when);
    if (lon === null) continue;
    out.push({
      key: spec.key,
      intoSign: signOf(lon),
      at: when.toISOString().slice(0, 10),
      daysUntil: Math.max(0, Math.round((when.getTime() - now) / DAY_MS)),
    });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** Sign index (0-11) of a sidereal longitude. */
export const signIndexOf: SignOf = (longitude) =>
  Math.floor(((((longitude % 360) + 360) % 360) / 30)) % 12;
