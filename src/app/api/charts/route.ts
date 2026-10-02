import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/session';

export const runtime = 'nodejs';

/** GET /api/charts — list saved charts */
export async function GET() {
  try {
    const user = await ensureUser();
    const charts = await db.birthChart.findMany({
      where: { userId: user.id },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({
      charts: charts.map((c) => ({
        id: c.id,
        name: c.name,
        dob: c.dob,
        tob: c.tob,
        lat: c.lat,
        lng: c.lng,
        timezone: c.timezone,
        placeName: c.placeName,
        isPrimary: c.isPrimary,
        chartData: JSON.parse(c.chartData),
      })),
    });
  } catch (e) {
    console.error('[charts GET]', e);
    return NextResponse.json({ charts: [] });
  }
}

/** POST /api/charts — save a chart (upsert by identity when primary) */
export async function POST(req: Request) {
  try {
    const user = await ensureUser();
    const b = await req.json();
    if (!b?.dob || !b?.tob || typeof b.lat !== 'number' || typeof b.lng !== 'number' || !b.timezone) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }
    const makePrimary = Boolean(b.makePrimary);

    // Guarantee a computed snapshot: charts added from Profile may arrive
    // without chartData — compute server-side so "Set active" always works.
    let chartDataJson: string;
    if (b.chartData) {
      chartDataJson = JSON.stringify(b.chartData);
    } else {
      const { computeChart } = await import('@/lib/astro/chart');
      chartDataJson = JSON.stringify(
        computeChart({
          name: String(b.name || 'Chart'),
          dob: String(b.dob),
          tob: String(b.tob),
          lat: Number(b.lat),
          lng: Number(b.lng),
          timezone: String(b.timezone),
          placeName: b.placeName ? String(b.placeName) : undefined,
        }),
      );
    }

    const existing = await db.birthChart.findFirst({
      where: { userId: user.id, dob: String(b.dob), tob: String(b.tob), lat: Number(b.lat), lng: Number(b.lng) },
    });
    if (existing) {
      const updated = await db.birthChart.update({
        where: { id: existing.id },
        data: { name: String(b.name || existing.name), chartData: chartDataJson, isPrimary: makePrimary || existing.isPrimary },
      });
      return NextResponse.json({ chart: { id: updated.id } });
    }
    if (makePrimary) {
      await db.birthChart.updateMany({ where: { userId: user.id }, data: { isPrimary: false } });
    }
    const created = await db.birthChart.create({
      data: {
        userId: user.id,
        name: String(b.name || 'Chart'),
        dob: String(b.dob),
        tob: String(b.tob),
        lat: Number(b.lat),
        lng: Number(b.lng),
        timezone: String(b.timezone),
        placeName: b.placeName ? String(b.placeName) : null,
        chartData: chartDataJson,
        isPrimary: makePrimary,
      },
    });
    return NextResponse.json({ chart: { id: created.id } });
  } catch (e) {
    console.error('[charts POST]', e);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}

/** PATCH /api/charts — { id, makePrimary } set active chart; self-heals missing chartData */
export async function PATCH(req: Request) {
  try {
    const user = await ensureUser();
    const { id, makePrimary } = await req.json();
    const chart = await db.birthChart.findFirst({ where: { id: String(id), userId: user.id } });
    if (!chart) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (makePrimary) {
      await db.birthChart.updateMany({ where: { userId: user.id }, data: { isPrimary: false } });
      await db.birthChart.update({ where: { id: chart.id }, data: { isPrimary: true } });
      // Repair legacy rows saved without a computed snapshot, so activating
      // them can never bounce the app back to onboarding.
      if (!chart.chartData || chart.chartData === 'null') {
        const { computeChart } = await import('@/lib/astro/chart');
        const computed = computeChart({
          name: chart.name,
          dob: chart.dob,
          tob: chart.tob,
          lat: chart.lat,
          lng: chart.lng,
          timezone: chart.timezone,
          placeName: chart.placeName ?? undefined,
        });
        await db.birthChart.update({ where: { id: chart.id }, data: { chartData: JSON.stringify(computed) } });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[charts PATCH]', e);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
}

/**
 * PUT /api/charts — update an existing chart's birth details IN PLACE.
 * Body: { id, name?, dob, tob, lat, lng, timezone, placeName? }
 * Recomputes chartData server-side; preserves isPrimary (no auto-switching).
 */
export async function PUT(req: Request) {
  try {
    const user = await ensureUser();
    const b = await req.json();
    const id = String(b?.id ?? '');
    if (!id || !b?.dob || !b?.tob || typeof b.lat !== 'number' || typeof b.lng !== 'number' || !b.timezone) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.dob))) {
      return NextResponse.json({ error: 'invalid_dob' }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(String(b.tob))) {
      return NextResponse.json({ error: 'invalid_tob' }, { status: 400 });
    }
    const chart = await db.birthChart.findFirst({ where: { id, userId: user.id } });
    if (!chart) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const { computeChart } = await import('@/lib/astro/chart');
    const computed = computeChart({
      name: String(b.name || chart.name || 'You'),
      dob: String(b.dob),
      tob: String(b.tob),
      lat: Number(b.lat),
      lng: Number(b.lng),
      timezone: String(b.timezone),
      placeName: b.placeName ? String(b.placeName) : undefined,
    });

    const updated = await db.birthChart.update({
      where: { id: chart.id },
      data: {
        name: computed.input.name,
        dob: computed.input.dob,
        tob: computed.input.tob,
        lat: computed.input.lat,
        lng: computed.input.lng,
        timezone: computed.input.timezone,
        placeName: computed.input.placeName ?? null,
        chartData: JSON.stringify(computed),
      },
    });
    return NextResponse.json({ chart: { id: updated.id, isPrimary: updated.isPrimary }, chartData: computed });
  } catch (e) {
    console.error('[charts PUT]', e);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
}

/** DELETE /api/charts?id=... */
export async function DELETE(req: Request) {
  try {
    const user = await ensureUser();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    // Deleting a chart also deletes that chart's own journal / chat / letters
    // / decision history (cascade). The client confirms this before calling.
    await db.birthChart.deleteMany({ where: { id, userId: user.id } });
    // Never leave the user without an active chart.
    const stillActive = await db.birthChart.findFirst({ where: { userId: user.id, isPrimary: true } });
    if (!stillActive) {
      const next = await db.birthChart.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
      if (next) await db.birthChart.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[charts DELETE]', e);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
