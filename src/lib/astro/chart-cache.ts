import { computeChart, type ComputedChart } from './chart';
import { memo } from '@/lib/cache';

type BirthInputLike = Parameters<typeof computeChart>[0];

/**
 * computeChart() takes 60–150 ms of CPU and is called by almost every API
 * route (Home alone triggers several per open). The natal part never changes
 * for a given birth input; only "today"-dependent fields (current dasha,
 * Sade Sati) change, and those only at midnight, so the cache key includes
 * the UTC day. Callers must treat the result as read-only.
 */
export function computeChartCached(input: BirthInputLike): ComputedChart {
  const day = new Date().toISOString().slice(0, 10);
  const key = `chart|${input.dob}|${input.tob}|${input.lat}|${input.lng}|${input.timezone}|${input.name ?? ''}|${day}`;
  return memo(key, 6 * 60 * 60 * 1000, () => computeChart(input));
}
