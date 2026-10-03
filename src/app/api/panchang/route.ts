import { NextResponse } from 'next/server';
import { panchangFor, daySummaryFor, type DaySummary } from '@/lib/astro/panchang';
import { enrichLunarDays, type BareDay } from '@/lib/astro/festivals';
import { zonedToUTC, ymdInZone, weekdayInZone, isValidTimeZone } from '@/lib/tz';
import type { FestivalInfo } from '@/lib/astro/festivals';

export const runtime = 'nodejs';

/** DaySummary + classical observance layer for the requested window. */
type RichDay = DaySummary & {
  lunarMonth: { key: string; en: string; hi: string; adhika?: boolean } | null;
  festivals: FestivalInfo[];
};

/** Scan a contiguous local-date range [start, end) and enrich the display days. */
function scanRange(
  y0: number,
  m0: number,
  d0: number,
  daysCount: number,
  padBefore: number,
  padAfter: number,
  timezone: string,
  lat: number,
  lng: number,
): { all: BareDay[]; display: DaySummary[] } {
  const total = daysCount + padBefore + padAfter;
  const all: BareDay[] = [];
  const display: DaySummary[] = [];
  for (let i = 0; i < total; i++) {
    // walk a proleptic day counter from (y0,m0,d0-padBefore)
    const base = Date.UTC(y0, m0 - 1, d0 - padBefore + i, 12, 0);
    const yy = new Date(base).getUTCFullYear();
    const mm = new Date(base).getUTCMonth() + 1;
    const dd = new Date(base).getUTCDate();
    const noonUTC = zonedToUTC(yy, mm, dd, 12, 0, timezone);
    const localDate = ymdInZone(timezone, noonUTC);
    const weekday = weekdayInZone(timezone, noonUTC);
    const summary = daySummaryFor(noonUTC, localDate, weekday, lat, lng);
    all.push({ date: summary.date, tithiIdx0: summary.tithiIdx0, nakIdx: summary.nakIdx, sunSignIdx: summary.sunSignIdx, elong: summary.elong });
    if (i >= padBefore && i < padBefore + daysCount) display.push(summary);
  }
  return { all, display };
}

function attachFestivals(display: DaySummary[], all: BareDay[]): RichDay[] {
  const displaySet = new Set(display.map((d) => d.date));
  const enriched = enrichLunarDays(all, displaySet);
  return display.map((d) => ({
    ...d,
    lunarMonth: enriched.get(d.date)?.lunarMonth ?? null,
    festivals: enriched.get(d.date)?.festivals ?? [],
  }));
}

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
      // Padded scan (±35 days) so the next-purnima lunar-month lookup resolves
      const { all, display } = scanRange(y, m, 1, daysInMonth, 35, 52, String(timezone), Number(lat), Number(lng));
      const days = attachFestivals(display, all);
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
    // Observance layer for the selected day (padded scan for lunar-month context)
    const { all, display } = scanRange(y, m, d, 1, 35, 52, String(timezone), Number(lat), Number(lng));
    const [rich] = attachFestivals(display, all);
    return NextResponse.json({ panchang, observance: { lunarMonth: rich.lunarMonth, festivals: rich.festivals } });
  } catch (e) {
    console.error('[panchang]', e);
    return NextResponse.json({ error: 'panchang_failed' }, { status: 500 });
  }
}
