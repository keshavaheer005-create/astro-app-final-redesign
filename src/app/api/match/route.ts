import { NextResponse } from 'next/server';
import { computeChart } from '@/lib/astro/chart';
import { ashtakoota } from '@/lib/astro/matching';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** POST /api/match — body { boy: BirthInput, girl: BirthInput } */
export async function POST(req: Request) {
  try {
    const { boy, girl } = await req.json();
    if (!boy?.dob || !boy?.tob || !girl?.dob || !girl?.tob) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    const boyChart = computeChart({
      name: String(boy.name || 'Boy'),
      dob: String(boy.dob),
      tob: String(boy.tob),
      lat: Number(boy.lat),
      lng: Number(boy.lng),
      timezone: String(boy.timezone),
      placeName: boy.placeName,
    });
    const girlChart = computeChart({
      name: String(girl.name || 'Girl'),
      dob: String(girl.dob),
      tob: String(girl.tob),
      lat: Number(girl.lat),
      lng: Number(girl.lng),
      timezone: String(girl.timezone),
      placeName: girl.placeName,
    });
    const boyMoon = boyChart.planets.find((p) => p.key === 'Mo')!;
    const girlMoon = girlChart.planets.find((p) => p.key === 'Mo')!;
    const match = ashtakoota({ moonLon: boyMoon.lon }, { moonLon: girlMoon.lon });

    return NextResponse.json({
      match,
      boySummary: {
        name: boyChart.input.name,
        ascendant: boyChart.ascendant.signName,
        moonSign: boyChart.moonSign.name,
        moonNakshatra: boyMoon.nakshatraName,
      },
      girlSummary: {
        name: girlChart.input.name,
        ascendant: girlChart.ascendant.signName,
        moonSign: girlChart.moonSign.name,
        moonNakshatra: girlMoon.nakshatraName,
      },
      boyMangalDosha: boyChart.mangalDosha,
      girlMangalDosha: girlChart.mangalDosha,
    });
  } catch (e) {
    console.error('[match]', e);
    return NextResponse.json({ error: 'match_failed' }, { status: 500 });
  }
}
