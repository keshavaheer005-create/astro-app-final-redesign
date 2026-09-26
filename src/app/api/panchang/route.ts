import { NextResponse } from 'next/server';
import { panchangFor, daySummaryFor, type DaySummary } from '@/lib/astro/panchang';
import { zonedToUTC, ymdInZone, weekdayInZone, isValidTimeZone } from '@/lib/tz';

export const runtime = 'nodejs';

/**
 * POST /api/panchang
 *  - body { date: 'YYYY-MM-DD', lat, lng, timezone } → full single-day panchang
 *  - body { month: 'YYYY-MM',   lat, lng, timezone } → lightweight month scan
 *    (tithi/nakshatra/sunrise per day + classical markers) for month views
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lat, lng, timezone } = body;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !isValidTimeZone(String(timezone))) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }

    // ── Month mode ──────────────────────────────────────────────────────────
    if (typeof body.month === 'string') {
      if (!/^\d{4}-\d{2}$/.test(body.month)) {
        return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
      }
      const [y, m] = body.month.split('-').map(Number);
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const days: DaySummary[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        // local noon of that date at that place — avoids DST edge cases
        const noonUTC = zonedToUTC(y, m, d, 12, 0, String(timezone));
        const localDate = ymdInZone(String(timezone), noonUTC);
        const weekday = weekdayInZone(String(timezone), noonUTC);
        days.push(daySummaryFor(noonUTC, localDate, weekday, Number(lat), Number(lng)));
      }
      return NextResponse.json({ month: body.month, days });
    }

    // ── Single-day mode ─────────────────────────────────────────────────────
    const { date } = body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }
    const [y, m, d] = String(date).split('-').map(Number);
    // local noon of that date at that place — avoids DST edge cases
    const noonUTC = zonedToUTC(y, m, d, 12, 0, String(timezone));
    const localDate = ymdInZone(String(timezone), noonUTC);
    const weekday = weekdayInZone(String(timezone), noonUTC);
    const panchang = panchangFor(noonUTC, Number(lat), Number(lng), String(timezone), localDate, weekday);
    return NextResponse.json({ panchang });
  } catch (e) {
    console.error('[panchang]', e);
    return NextResponse.json({ error: 'panchang_failed' }, { status: 500 });
  }
}
