import { NextResponse } from 'next/server';
import { daySummaryFor, type DaySummary } from '@/lib/astro/panchang';
import { enrichLunarDays, SANKRANTI_NAMES, EKADASHI_NAMES, type BareDay, type LocalizedName } from '@/lib/astro/festivals';
import { zonedToUTC, ymdInZone, weekdayInZone, isValidTimeZone } from '@/lib/tz';

export const runtime = 'nodejs';

/**
 * GET /api/sky-highlights?lat=&lng=&timezone=
 *
 * Scans the next `DAYS` local days (padded scan for lunar-month context) and
 * picks the upcoming classical sky events:
 *   • next Purnima / Amavasya / Ekadashi (tithi markers)
 *   • next Sankranti (sidereal Sun sign change)
 *   • every named festival within the window
 * Returns a merged, date-sorted feed for the Home "Sky ahead" strip.
 */

const DAYS = 32; // display window
const PAD_BEFORE = 35; // enrichLunarDays contract (see festivals.ts)
const PAD_AFTER = 52;

export type SkyItem = {
  date: string; // local YYYY-MM-DD
  kind: 'purnima' | 'amavasya' | 'ekadashi' | 'sankranti' | 'festival';
  name: LocalizedName;
  daysUntil: number;
};

function scan(todayLocal: string, timezone: string, lat: number, lng: number) {
  const base = new Date(`${todayLocal}T12:00:00Z`);
  const total = DAYS + PAD_BEFORE + PAD_AFTER;
  const all: BareDay[] = [];
  const display: DaySummary[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(base.getTime() + (i - PAD_BEFORE) * 86400000);
    const yy = d.getUTCFullYear();
    const mm = d.getUTCMonth() + 1;
    const dd = d.getUTCDate();
    const noonUTC = zonedToUTC(yy, mm, dd, 12, 0, timezone);
    const localDate = ymdInZone(timezone, noonUTC);
    const weekday = weekdayInZone(timezone, noonUTC);
    const summary = daySummaryFor(noonUTC, localDate, weekday, lat, lng);
    all.push({ date: summary.date, tithiIdx0: summary.tithiIdx0, nakIdx: summary.nakIdx, sunSignIdx: summary.sunSignIdx, elong: summary.elong });
    if (i >= PAD_BEFORE && i < PAD_BEFORE + DAYS) display.push(summary);
  }
  return { all, display };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    const timezone = String(url.searchParams.get('timezone') ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isValidTimeZone(timezone)) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }

    // today in the target zone
    const nowUtc = new Date();
    const todayLocal = ymdInZone(timezone, nowUtc);
    const { all, display } = scan(todayLocal, timezone, lat, lng);

    const displaySet = new Set(display.map((d) => d.date));
    const enriched = enrichLunarDays(all, displaySet);

    const todayIdx = display.findIndex((d) => d.date === todayLocal);
    const msDay = 86400000;
    const daysUntil = (d: DaySummary) =>
      todayIdx >= 0
        ? display.findIndex((x) => x.date === d.date) - todayIdx
        : Math.round((new Date(`${d.date}T12:00:00Z`).getTime() - new Date(`${todayLocal}T12:00:00Z`).getTime()) / msDay);

    const items: SkyItem[] = [];
    const picked = new Set<string>();

    // 1. Tithi markers — first purnima / amavasya / ekadashi in the window
    const markers: { kind: SkyItem['kind']; when: (d: DaySummary) => boolean; name: LocalizedName }[] = [
      { kind: 'purnima', when: (d) => d.special === 'purnima', name: { en: 'Purnima · Full Moon', hi: 'पूर्णिमा' } },
      { kind: 'amavasya', when: (d) => d.special === 'amavasya', name: { en: 'Amavasya · New Moon', hi: 'अमावस्या' } },
      { kind: 'ekadashi', when: (d) => d.special === 'ekadashi', name: { en: 'Ekadashi', hi: 'एकादशी' } },
    ];
    for (const m of markers) {
      const hit = display.find((d) => m.when(d) && !picked.has(d.date));
      if (hit) {
        picked.add(hit.date);
        // Prefer the classical festival name covering the day (e.g. "Sharad Purnima")
        const fest = (enriched.get(hit.date)?.festivals ?? []).filter((f) => f.kind !== 'sankranti');
        const name = fest.length > 0 ? { en: fest[0].en, hi: fest[0].hi } : m.name;
        items.push({ date: hit.date, kind: m.kind, name, daysUntil: daysUntil(hit) });
      }
    }

    // 2. Named ekadashi overlay — upgrade the generic marker name when the
    //    purnimanta month lets us resolve the classical ekadashi name.
    const ek = items.find((i) => i.kind === 'ekadashi');
    if (ek) {
      const monthKey = enriched.get(ek.date)?.lunarMonth?.key;
      const day = display.find((d) => d.date === ek.date);
      if (monthKey && day) {
        const paksha = day.tithi.paksha === 'Shukla' ? 'shukla' : 'krishna';
        const named = EKADASHI_NAMES[monthKey]?.[paksha];
        if (named) ek.name = named;
      }
    }

    // 3. Sankranti — first Sun sign change from today forward
    for (let i = Math.max(todayIdx, 0) + 1; i < display.length; i++) {
      if (display[i].sunSignIdx !== display[i - 1].sunSignIdx) {
        picked.add(display[i].date);
        items.push({
          date: display[i].date,
          kind: 'sankranti',
          name: SANKRANTI_NAMES[display[i].sunSignIdx] ?? { en: 'Sankranti', hi: 'संक्रांति' },
          daysUntil: daysUntil(display[i]),
        });
        break;
      }
    }

    // 4. Named festivals on remaining days (one per day, first listed)
    for (const d of display) {
      if (picked.has(d.date)) continue;
      const fests = (enriched.get(d.date)?.festivals ?? []).filter((f) => f.kind === 'festival');
      if (fests.length > 0) {
        picked.add(d.date);
        items.push({ date: d.date, kind: 'festival', name: { en: fests[0].en, hi: fests[0].hi }, daysUntil: daysUntil(d) });
      }
    }

    items.sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json({ today: todayLocal, items });
  } catch (e) {
    console.error('[sky-highlights]', e);
    return NextResponse.json({ error: 'sky_highlights_failed' }, { status: 500 });
  }
}
