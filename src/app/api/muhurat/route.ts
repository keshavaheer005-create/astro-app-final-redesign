import { NextResponse } from 'next/server';
import { memo } from '@/lib/cache';
import { ACTIVITIES, findMuhurats, type Activity } from '@/lib/astro/muhurat-finder';
import { isValidTimeZone } from '@/lib/tz';

export const runtime = 'nodejs';

/**
 * POST /api/muhurat
 *   { activity, startDate: 'YYYY-MM-DD', days (1..120), lat, lng, timezone,
 *     natalNak?: 0..26, natalMoonSign?: 0..11 }
 * → ranked auspicious days with time windows and reasons.
 */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const activity = String(b.activity) as Activity;
    const startDate = String(b.startDate ?? '');
    const days = Math.max(1, Math.min(120, Math.floor(Number(b.days) || 30)));
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    const timezone = String(b.timezone ?? '');
    if (
      !(ACTIVITIES as readonly string[]).includes(activity) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 ||
      !isValidTimeZone(timezone)
    ) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }
    const natalNak = Number.isInteger(b.natalNak) && b.natalNak >= 0 && b.natalNak < 27 ? (b.natalNak as number) : undefined;
    const natalMoonSign = Number.isInteger(b.natalMoonSign) && b.natalMoonSign >= 0 && b.natalMoonSign < 12 ? (b.natalMoonSign as number) : undefined;

    // same search within 30 min → instant (a 90-day scan is ~0.2–0.5 s of CPU)
    const key = `muhurat|${activity}|${startDate}|${days}|${lat.toFixed(2)}|${lng.toFixed(2)}|${timezone}|${natalNak ?? '-'}|${natalMoonSign ?? '-'}`;
    const results = memo(key, 30 * 60 * 1000, () =>
      findMuhurats({ activity, startDate, days, lat, lng, timezone, natalNak, natalMoonSign }),
    );
    return NextResponse.json({ activity, startDate, days, results: results.slice(0, 20) }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (e) {
    console.error('[muhurat]', e);
    return NextResponse.json({ error: 'muhurat_failed' }, { status: 500 });
  }
}
