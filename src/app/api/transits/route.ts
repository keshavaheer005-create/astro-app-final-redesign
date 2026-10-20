import { NextResponse } from 'next/server';
import { ensureUser } from '@/lib/session';
import { getActiveChart } from '@/lib/active-chart';
import { computeChartCached as computeChart } from '@/lib/astro/chart-cache';
import type { ComputedChart } from '@/lib/astro/chart';
import { transitPositions } from '@/lib/astro/horoscope';
import { calcPlanet, juldayFromUTC } from '@/lib/astro/ephemeris';
import { scanIngresses, signIndexOf, type Ingress } from '@/lib/astro/transit-scan';
import type { PlanetKey } from '@/lib/astro/constants';
import { memo } from '@/lib/cache';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/transits
 *
 * "Where are the grahas right now, and when do the slow ones change sign?"
 * for the ACTIVE saved chart (same privacy shape as /api/dasha-now — the birth
 * details never leave the server).
 *
 * `ingresses` does not depend on the birth chart at all, so it is memoised per
 * UTC day and shared by every user of this server process.
 */

/** Slow grahas only: fast ones change sign too often to be a planning signal. */
const INGRESS_PLANETS: { key: PlanetKey; windowDays: number; coarseDays: number }[] = [
  // Saturn ~2.5 years per sign; 30-day steps keep the scan under ~150 samples.
  { key: 'Sa', windowDays: 365 * 12, coarseDays: 30 },
  // Jupiter ~1 year per sign; Rahu ~18 months (always retrograde).
  { key: 'Ju', windowDays: 365 * 2, coarseDays: 15 },
  { key: 'Ra', windowDays: 365 * 2, coarseDays: 15 },
];

function ingressesToday(now: Date): Ingress[] {
  const day = now.toISOString().slice(0, 10);
  return memo(`transits|ingress|${day}`, 12 * 60 * 60 * 1000, () => {
    const from = new Date(`${day}T00:00:00Z`);
    return scanIngresses(
      INGRESS_PLANETS.map((spec) => ({
        key: spec.key,
        windowDays: spec.windowDays,
        coarseDays: spec.coarseDays,
        positionAt: (d: Date) => calcPlanet(spec.key, juldayFromUTC(d), true).lon,
      })),
      signIndexOf,
      from,
    );
  });
}

/** Read the stored snapshot when it is usable — avoids re-running the engine. */
function chartFromRow(chartData: string): ComputedChart | null {
  try {
    const parsed = JSON.parse(chartData) as ComputedChart;
    if (!Array.isArray(parsed?.planets) || typeof parsed?.ascendant?.sign !== 'number') return null;
    if (!parsed.planets.some((p) => p.key === 'Mo')) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const user = await ensureUser();
    const saved = await getActiveChart(user.id);
    if (!saved) return NextResponse.json({ error: 'no_chart' }, { status: 400 });

    const chart =
      chartFromRow(saved.chartData) ??
      computeChart({
        name: saved.name,
        dob: saved.dob,
        tob: saved.tob,
        lat: saved.lat,
        lng: saved.lng,
        timezone: saved.timezone,
        placeName: saved.placeName ?? undefined,
      });

    const moon = chart.planets.find((p) => p.key === 'Mo');
    if (!moon) return NextResponse.json({ error: 'no_moon' }, { status: 500 });

    const now = new Date();
    return NextResponse.json(
      {
        asOf: now.toISOString(),
        chartId: saved.id,
        positions: transitPositions(moon.lon, chart.ascendant.sign, now),
        ingresses: ingressesToday(now),
      },
      {
        // Private + short cache: the client also keeps an SWR copy for 6 h.
        headers: { 'Cache-Control': 'private, max-age=900' },
      },
    );
  } catch (e) {
    console.error('[transits]', e);
    return NextResponse.json({ error: 'transits_failed' }, { status: 500 });
  }
}
