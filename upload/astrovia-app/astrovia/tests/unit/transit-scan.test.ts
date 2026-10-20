/// <reference types="bun-types" />
/**
 * Sign-ingress scanning. The scan takes a position callback, so it can be
 * tested with synthetic motion and never needs the native Swiss Ephemeris.
 */
import { describe, expect, test } from 'bun:test';
import { nextIngress, scanIngresses, type Ingress } from '../../src/lib/astro/transit-scan';
const DAY = 86_400_000;
const signOf = (lon: number) => Math.floor((((lon % 360) + 360) % 360) / 30);
const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Steady 1°/day: Aries → Taurus after ~30 days from 0°. */
const linear = (startLon: number, degPerDay: number) => {
  const t0 = at('2026-01-01').getTime();
  return (d: Date) => startLon + ((d.getTime() - t0) / DAY) * degPerDay;
};

describe('nextIngress', () => {
  test('finds the sign change of steady motion', () => {
    const found = nextIngress(linear(5, 1), signOf, at('2026-01-01'), 60);
    expect(found).not.toBeNull();
    expect(signOf(linear(5, 1)(found!))).toBe(1); // Taurus
    // 5° → 30° at 1°/day is ~25 days out (day granularity).
    expect(found!.getTime() - at('2026-01-01').getTime()).toBeGreaterThanOrEqual(24 * DAY);
    expect(found!.getTime() - at('2026-01-01').getTime()).toBeLessThanOrEqual(26 * DAY);
  });

  test('returns null when no change happens inside the window', () => {
    expect(nextIngress(linear(5, 0.01), signOf, at('2026-01-01'), 30)).toBeNull();
  });

  test('reports the FIRST crossing when motion is retrograde and loops back', () => {
    // Starts just below 30° (Aries), crosses into Taurus, then reverses into
    // Aries again. The answer must be the first crossing (Taurus), not the
    // later re-entry into Aries.
    const t0 = at('2026-01-01').getTime();
    const position = (d: Date) => {
      const days = (d.getTime() - t0) / DAY;
      // +0.2°/day for 10 days (crosses at day 5), then -0.5°/day.
      return days <= 10 ? 29 + days * 0.2 : 31 - (days - 10) * 0.5;
    };
    const found = nextIngress(position, signOf, at('2026-01-01'), 40);
    expect(found).not.toBeNull();
    expect(signOf(position(found!))).toBe(1);
    expect(found!.getTime() - t0).toBeLessThan(10 * DAY);
  });

  test('handles wraparound 359° → 0°', () => {
    const found = nextIngress(linear(359, 1), signOf, at('2026-01-01'), 10);
    expect(found).not.toBeNull();
    expect(signOf(linear(359, 1)(found!))).toBe(0);
  });
});

describe('scanIngresses', () => {
  test('returns one ingress per planet that changes sign, sorted by date', () => {
    const t0 = at('2026-01-01').getTime();
    const specs = [
      // moves 1 deg/day from 20 Aries -> changes sign in ~10 days
      { key: 'Sa' as const, windowDays: 40, positionAt: (d: Date) => 20 + ((d.getTime() - t0) / DAY) * 1 },
      // barely moves -> no ingress
      { key: 'Ju' as const, windowDays: 40, positionAt: () => 5 },
    ];
    const out = scanIngresses(specs, signOf, at('2026-01-01'));
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('Sa');
    expect(out[0].intoSign).toBe(1);
    expect(out[0].daysUntil).toBeGreaterThan(0);
  });

  test('scanIngresses skips planets with no change in the window', () => {
    const out = scanIngresses(
      [{ key: 'Sa', windowDays: 30, positionAt: () => 5 }],
      signOf,
      at('2026-01-01'),
    );
    expect(out).toEqual([]);
  });
});
