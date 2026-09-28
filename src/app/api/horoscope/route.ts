import { NextResponse } from 'next/server';
import { computeChart } from '@/lib/astro/chart';
import { horoscope } from '@/lib/astro/horoscope';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/horoscope
 * body { period: 'daily'|'weekly'|'monthly'|'yearly', birth: BirthInput }
 * → structured gochara data (client renders localized sentences)
 */
export async function POST(req: Request) {
  try {
    const { period, birth } = await req.json();
    const p = ['daily', 'weekly', 'monthly', 'yearly'].includes(period) ? period : 'daily';
    if (!birth?.dob || !birth?.tob) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    const chart = computeChart({
      name: String(birth.name || 'You'),
      dob: String(birth.dob),
      tob: String(birth.tob),
      lat: Number(birth.lat),
      lng: Number(birth.lng),
      timezone: String(birth.timezone),
      placeName: birth.placeName,
    });
    const moon = chart.planets.find((pl) => pl.key === 'Mo')!;
    const ds = chart.dashaSnapshot;
    const dashaNote = ds ? `${ds.mahaLord} mahadasha, ${ds.antarLord ?? ''} antardasha` : '';
    const result = horoscope(p as 'daily', new Date(), moon.lon, dashaNote);
    return NextResponse.json({ horoscope: result });
  } catch (e) {
    console.error('[horoscope]', e);
    return NextResponse.json({ error: 'horoscope_failed' }, { status: 500 });
  }
}
