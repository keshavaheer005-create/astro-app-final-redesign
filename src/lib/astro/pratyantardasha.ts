/**
 * Pratyantardasha (level 3) derived on the CLIENT from the stored dasha tree.
 *
 * The engine (`src/lib/astro/dasha.ts`) computes and persists only mahadasha and
 * antardasha periods. Pratyantardashas do not need a server round trip: they are
 * a proportional subdivision of an antardasha, and everything required (the
 * antardasha lord, its stored start/end, DASHA_YEARS) is already in the chart
 * JSON on the client. Deriving here means:
 *   • charts already stored in the database need no recomputation or migration;
 *   • the endpoint stays cheap;
 *   • the maths is a pure function that can be unit-tested.
 *
 * Rule (classical Vimshottari): inside an antardasha of lord L spanning Y years,
 * the sub-period of lord S lasts `Y × years(S) / 120`. We apply that ratio to the
 * STORED antardasha length rather than to the theoretical years, so the last
 * pratyantardasha always ends exactly on the stored antardasha end — legacy
 * charts whose dates came from an older build still line up.
 */
import { DASHA_SEQUENCE, DASHA_YEARS, type PlanetKey } from './constants';

export interface DashaPeriod {
  lord: PlanetKey;
  start: string; // YYYY-MM-DD (UTC day)
  end: string;
}

/** The 120-year Vimshottari cycle. */
export const VIMSHOTTARI_TOTAL_YEARS = 120;

/**
 * Sub-periods of one antardasha, in order, covering it exactly.
 * Returns `[]` for an unknown lord or an unusable date range.
 */
export function pratyantarsFor(antar: DashaPeriod): DashaPeriod[] {
  if (!antar || !antar.lord) return [];
  const startMs = Date.parse(`${antar.start}T00:00:00Z`);
  const endMs = Date.parse(`${antar.end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];

  const lordPos = DASHA_SEQUENCE.indexOf(antar.lord);
  if (lordPos < 0) return [];

  const totalMs = endMs - startMs;
  const out: DashaPeriod[] = [];
  let cursor = startMs;

  for (let i = 0; i < 9; i++) {
    const subLord = DASHA_SEQUENCE[(lordPos + i) % 9];
    const span = (totalMs * DASHA_YEARS[subLord]) / VIMSHOTTARI_TOTAL_YEARS;
    // Anchor the final boundary to the antardasha's own end so rounding can
    // never leave a gap or an overlap at the edge.
    const next = i === 8 ? endMs : Math.round(cursor + span);
    out.push({
      lord: subLord,
      start: new Date(cursor).toISOString().slice(0, 10),
      end: new Date(next).toISOString().slice(0, 10),
    });
    cursor = next;
  }

  return out;
}

/**
 * The period containing `todayIso`, using the same half-open convention as the
 * engine (`start <= today < end`), so exactly one period is ever "current".
 */
export function activePeriod<T extends { start: string; end: string }>(
  periods: readonly T[],
  todayIso: string,
): T | null {
  if (!periods || periods.length === 0) return null;
  for (const p of periods) {
    if (p.start <= todayIso && todayIso < p.end) return p;
  }
  return null;
}

/** Index of the active period, or -1 — handy for rendering a "now" marker. */
export function activeIndex(periods: readonly { start: string; end: string }[], todayIso: string): number {
  return periods.findIndex((p) => p.start <= todayIso && todayIso < p.end);
}
