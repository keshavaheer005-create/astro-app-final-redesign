/// <reference types="bun-types" />
/**
 * Pratyantardasha derivation: the third dasha level is computed on the client
 * from the stored maha/antar tree, so these tests pin the arithmetic down.
 */
import { describe, expect, test } from 'bun:test';
import {
  activeIndex,
  activePeriod,
  pratyantarsFor,
  type DashaPeriod,
} from '../../src/lib/astro/pratyantardasha';
import { DASHA_SEQUENCE, DASHA_YEARS } from '../../src/lib/astro/constants';

/** A realistic 2-year antardasha (Saturn-Jupiter spans ~2.13y). */
const ANTAR: DashaPeriod = { lord: 'Sa', start: '2024-01-01', end: '2026-01-01' };

describe('pratyantarsFor', () => {
  test('produces nine sub-periods starting with the antardasha lord', () => {
    const out = pratyantarsFor(ANTAR);
    expect(out).toHaveLength(9);
    expect(out[0].lord).toBe('Sa');
    // Sequence continues in Vimshottari order from the antar lord.
    const pos = DASHA_SEQUENCE.indexOf('Sa');
    expect(out.map((p) => p.lord)).toEqual(
      Array.from({ length: 9 }, (_, i) => DASHA_SEQUENCE[(pos + i) % 9]),
    );
  });

  test('periods are contiguous and start/end on the antardasha bounds', () => {
    const out = pratyantarsFor(ANTAR);
    expect(out[0].start).toBe('2024-01-01');
    expect(out[out.length - 1].end).toBe('2026-01-01');
    for (let i = 1; i < out.length; i++) {
      expect(out[i].start).toBe(out[i - 1].end);
    }
  });

  test('sub-period lengths follow the 120-year proportion', () => {
    const out = pratyantarsFor(ANTAR);
    const totalDays = (Date.parse('2026-01-01T00:00:00Z') - Date.parse('2024-01-01T00:00:00Z')) / 86_400_000;
    for (const p of out) {
      const days = (Date.parse(`${p.end}T00:00:00Z`) - Date.parse(`${p.start}T00:00:00Z`)) / 86_400_000;
      const expected = (totalDays * DASHA_YEARS[p.lord]) / 120;
      // Day-granularity storage plus the anchored last boundary: allow 1 day.
      expect(Math.abs(days - expected)).toBeLessThanOrEqual(1);
    }
  });

  test('rejects unusable input instead of inventing periods', () => {
    expect(pratyantarsFor({ ...ANTAR, end: ANTAR.start })).toEqual([]);
    expect(pratyantarsFor({ ...ANTAR, end: '2023-01-01' })).toEqual([]);
    expect(pratyantarsFor({ ...ANTAR, lord: 'Xx' as never })).toEqual([]);
  });

  test('the last sub-period never overruns the antardasha end', () => {
    const odd: DashaPeriod = { lord: 'Mo', start: '2025-03-07', end: '2025-03-20' };
    const out = pratyantarsFor(odd);
    expect(out[out.length - 1].end).toBe('2025-03-20');
    for (const p of out) {
      expect(p.start >= odd.start).toBe(true);
      expect(p.end <= odd.end).toBe(true);
    }
  });
});

describe('activePeriod / activeIndex', () => {
  const periods = pratyantarsFor(ANTAR);

  test('boundaries are half-open: start is inside, end is outside', () => {
    expect(activeIndex(periods, periods[0].start)).toBe(0);
    expect(activeIndex(periods, periods[0].end)).toBe(1);
    expect(activeIndex(periods, periods[periods.length - 1].end)).toBe(-1);
  });

  test('returns exactly one current period', () => {
    const hit = activePeriod(periods, '2025-06-01');
    expect(hit).not.toBeNull();
    const matches = periods.filter((p) => p.start <= '2025-06-01' && '2025-06-01' < p.end);
    expect(matches).toHaveLength(1);
    expect(hit).toEqual(matches[0]);
  });

  test('handles an empty list', () => {
    expect(activePeriod([], '2025-06-01')).toBeNull();
    expect(activeIndex([], '2025-06-01')).toBe(-1);
  });
});
