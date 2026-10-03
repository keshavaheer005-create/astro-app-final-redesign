import { NextResponse } from 'next/server';
import { computeChart } from '@/lib/astro/chart';
import { ensureUser, guestChartLimitReached } from '@/lib/session';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/chart
 * Body: { name, dob, tob, lat, lng, timezone, placeName?, save? }
 * → full chart JSON (sidereal, Lahiri ayanamsa, whole-sign houses)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, dob, tob, lat, lng, timezone, placeName, save } = body ?? {};

    if (!dob || !tob || typeof lat !== 'number' || typeof lng !== 'number' || !timezone) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dob))) {
      return NextResponse.json({ error: 'invalid_dob' }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(String(tob))) {
      return NextResponse.json({ error: 'invalid_tob' }, { status: 400 });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'invalid_coords' }, { status: 400 });
    }

    const chart = computeChart({
      name: String(name || 'You'),
      dob: String(dob),
      tob: String(tob),
      lat: Number(lat),
      lng: Number(lng),
      timezone: String(timezone),
      placeName: placeName ? String(placeName) : undefined,
    });

    // Optionally persist as the user's primary chart
    if (save) {
      try {
        const user = await ensureUser();
        await dbSaveChart(user.id, chart);
      } catch (e) {
        console.error('[chart] save failed (returning chart anyway)', e);
      }
    }

    return NextResponse.json({ chart });
  } catch (e) {
    console.error('[chart] compute failed', e);
    return NextResponse.json({ error: 'compute_failed' }, { status: 500 });
  }
}

async function dbSaveChart(userId: string, chart: import('@/lib/astro/chart').ComputedChart) {
  const { db } = await import('@/lib/db');
  const data = {
    name: chart.input.name,
    dob: chart.input.dob,
    tob: chart.input.tob,
    lat: chart.input.lat,
    lng: chart.input.lng,
    timezone: chart.input.timezone,
    placeName: chart.input.placeName ?? null,
    chartData: JSON.stringify(chart),
  };
  // Identity match first (same dob/tob/place → update in place, never duplicate);
  // otherwise create. Either way this becomes the user's single active chart.
  const existing = await db.birthChart.findFirst({
    where: {
      userId,
      dob: chart.input.dob,
      tob: chart.input.tob,
      lat: chart.input.lat,
      lng: chart.input.lng,
    },
  });
  if (existing) {
    await db.birthChart.updateMany({ where: { userId }, data: { isPrimary: false } });
    await db.birthChart.update({ where: { id: existing.id }, data: { ...data, isPrimary: true } });
  } else {
    // Guests keep one chart; the chart is still returned, just not saved as a 2nd.
    if (await guestChartLimitReached(userId)) return;
    await db.birthChart.updateMany({ where: { userId }, data: { isPrimary: false } });
    await db.birthChart.create({ data: { userId, isPrimary: true, ...data } });
  }
}
