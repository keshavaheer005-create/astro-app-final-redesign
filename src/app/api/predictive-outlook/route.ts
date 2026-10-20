import { NextResponse } from 'next/server';
import { ensureUser } from '@/lib/session';
import { getActiveChart } from '@/lib/active-chart';
import { computeChartCached } from '@/lib/astro/chart-cache';
import { calcAllPlanets, juldayFromUTC } from '@/lib/astro/ephemeris';
import { buildPredictiveOutlook } from '@/lib/astro/prediction-engine';
import { memo } from '@/lib/cache';
import { ymdInZone } from '@/lib/tz';

export const runtime = 'nodejs';

/**
 * GET /api/predictive-outlook
 * Compact, chart-scoped outlook from the current Vimshottari period, natal
 * house lords, divisional-chart anchors, current sidereal transits and (when
 * available) classical Ashtakavarga. No AI request is made for this endpoint.
 */
export async function GET() {
  try {
    const user = await ensureUser();
    const saved = await getActiveChart(user.id);
    if (!saved) return NextResponse.json({ error: 'no_chart' }, { status: 400 });

    const now = new Date();
    const localDay = ymdInZone(saved.timezone, now);
    const utcHour = Math.floor(now.getTime() / 3_600_000);
    const outlook = memo(`predictive-outlook|${saved.id}|${localDay}|${utcHour}`, 60 * 60 * 1000, () => {
      const chart = computeChartCached({
        name: saved.name,
        dob: saved.dob,
        tob: saved.tob,
        lat: saved.lat,
        lng: saved.lng,
        timezone: saved.timezone,
        placeName: saved.placeName ?? undefined,
      });
      const transit = calcAllPlanets(juldayFromUTC(now), true);
      return buildPredictiveOutlook(chart, transit, now);
    });

    return NextResponse.json(
      { outlook },
      { headers: { 'Cache-Control': 'private, max-age=900' } },
    );
  } catch (error) {
    console.error('[predictive-outlook]', error);
    return NextResponse.json({ error: 'predictive_outlook_failed' }, { status: 500 });
  }
}
