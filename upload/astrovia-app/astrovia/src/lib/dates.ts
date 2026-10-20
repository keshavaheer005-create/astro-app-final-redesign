/**
 * Date helpers shared by the dasha/transit screens.
 *
 * Vimshottari period boundaries are stored as `YYYY-MM-DD` strings (UTC days),
 * because that is what the engine writes into `chart.dashas`. Everything here
 * therefore treats a period date as UTC midnight, and string comparison of two
 * such dates is chronological — no timezone conversion is applied, matching the
 * existing dasha cards on the Reports screen.
 */

export const DAY_MS = 86_400_000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value);
}

/** UTC midnight of an ISO day, in ms. `NaN` when the string is not a date. */
export function isoDayMs(iso: string): number {
  if (!isIsoDate(iso)) return Number.NaN;
  return Date.parse(`${iso}T00:00:00Z`);
}

/** Today's UTC day, `YYYY-MM-DD`. */
export function todayIso(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const ms = isoDayMs(iso);
  if (!Number.isFinite(ms)) return iso;
  return isoFromMs(ms + days * DAY_MS);
}

/**
 * % of the [start, end] window already elapsed, clamped to 0–100.
 * Returns 0 for an invalid or empty window.
 */
export function pctBetween(start: string, end: string, now: number = Date.now()): number {
  const a = isoDayMs(start);
  const b = isoDayMs(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.max(0, Math.min(100, ((now - a) / (b - a)) * 100));
}

/** Whole days from today until `iso` (negative when in the past). */
export function daysUntil(iso: string, now: number = Date.now()): number {
  const ms = isoDayMs(iso);
  if (!Number.isFinite(ms)) return 0;
  return Math.ceil((ms - now) / DAY_MS);
}

/** Whole days already elapsed since `iso` (never negative). */
export function daysSince(iso: string, now: number = Date.now()): number {
  const ms = isoDayMs(iso);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor((now - ms) / DAY_MS));
}

/** True when `iso` falls inside the half-open window [start, end). */
export function inWindow(start: string, end: string, iso: string): boolean {
  if (!isIsoDate(start) || !isIsoDate(end) || !isIsoDate(iso)) return false;
  return start <= iso && iso < end;
}

/**
 * Human-ish range for a period: "Mar 2024 → Nov 2026". Localised by the caller
 * through `Intl.DateTimeFormat`; this only supplies the two dates.
 */
export function periodYears(iso: string): string {
  return iso.slice(0, 4);
}
