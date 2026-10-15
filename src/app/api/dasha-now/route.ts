import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/session';
import { computeChartCached as computeChart } from '@/lib/astro/chart-cache';
import type { PlanetKey } from '@/lib/astro/constants';

export const runtime = 'nodejs';

/**
 * GET /api/dasha-now
 * Returns the current Vimshottari maha/antardasha plus the next transition
 * (antardasha, or mahadasha when the antar is the last in the maha) so the
 * Home screen can show a countdown card.
 */
export async function GET() {
  try {
    const user = await ensureUser();
    const saved = await db.birthChart.findFirst({ where: { userId: user.id, isPrimary: true } });
    if (!saved) return NextResponse.json({ error: 'no_chart' }, { status: 400 });

    const chart = computeChart({
      name: saved.name,
      dob: saved.dob,
      tob: saved.tob,
      lat: saved.lat,
      lng: saved.lng,
      timezone: saved.timezone,
    });

    const ds = chart.dashaSnapshot;
    if (!ds || !ds.antarEnd) return NextResponse.json({ error: 'no_dasha' }, { status: 404 });

    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const daysLeft = Math.ceil((new Date(`${ds.antarEnd}T12:00:00Z`).getTime() - today.getTime()) / 86400000);

    // Elapsed % of the current antardasha
    const aStart = new Date(`${ds.antarStart}T12:00:00Z`).getTime();
    const aEnd = new Date(`${ds.antarEnd}T12:00:00Z`).getTime();
    const antarPercent = Math.max(0, Math.min(100, Math.round(((today.getTime() - aStart) / (aEnd - aStart)) * 100)));

    // Find the next antardasha lord from the full dasha tree
    const maha = chart.dashas.mahadashas.find((m) => m.start <= todayISO && m.end > todayISO);
    let nextLord: PlanetKey | null = null;
    let isMahaChange = false;
    if (maha) {
      const idx = maha.antardashas.findIndex((a) => a.start <= todayISO && a.end > todayISO);
      if (idx >= 0) {
        if (idx + 1 < maha.antardashas.length) {
          nextLord = maha.antardashas[idx + 1].lord;
        } else {
          // last antar of the maha → the next maha begins (starts with its own lord)
          const mIdx = chart.dashas.mahadashas.findIndex((m) => m.lord === maha.lord);
          const nextMaha = chart.dashas.mahadashas[mIdx + 1];
          if (nextMaha) {
            nextLord = nextMaha.lord;
            isMahaChange = true;
          }
        }
      }
    }

    return NextResponse.json({
      dasha: {
        mahaLord: ds.mahaLord,
        antarLord: ds.antarLord,
        mahaStart: ds.mahaStart,
        mahaEnd: ds.mahaEnd,
        antarStart: ds.antarStart,
        antarEnd: ds.antarEnd,
        antarPercent,
        next: { lord: nextLord, isMahaChange, dateISO: ds.antarEnd, daysLeft },
      },
    }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (e) {
    console.error('[dasha-now]', e);
    return NextResponse.json({ error: 'dasha_now_failed' }, { status: 500 });
  }
}
