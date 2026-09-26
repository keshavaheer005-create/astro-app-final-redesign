import { NextResponse } from 'next/server';
import { panchangFor } from '@/lib/astro/panchang';
import { zonedToUTC, ymdInZone, weekdayInZone, isValidTimeZone } from '@/lib/tz';

export const runtime = 'nodejs';

/** POST /api/panchang — body { date: 'YYYY-MM-DD', lat, lng, timezone } */
export async function POST(req: Request) {
  try {
    const { date, lat, lng, timezone } = await req.json();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || typeof lat !== 'number' || typeof lng !== 'number' || !isValidTimeZone(String(timezone))) {
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
