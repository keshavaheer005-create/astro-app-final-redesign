import { NextResponse } from 'next/server';
import { patternNarrative } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST /api/pattern-narrative — body { aggregates, language? } → Acharya phrased insight */
export async function POST(req: Request) {
  try {
    const { aggregates, language } = await req.json();
    if (!aggregates) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    const text = await patternNarrative({
      language: language === 'hi' ? 'hi' : 'en',
      aggregates: {
        days: aggregates.days ?? 0,
        avgMood: aggregates.avgMood ?? null,
        bestPeriod: aggregates.bestPeriod ?? null,
        worstPeriod: aggregates.worstPeriod ?? null,
        moodEnergyCorrelation: aggregates.correlation ?? null,
        weekendEffect: aggregates.weekendEffect ?? null,
        notableNotes: (aggregates.notableNotes ?? []).slice(0, 3),
      },
    });
    return NextResponse.json({ narrative: text });
  } catch (e) {
    console.error('[pattern-narrative]', e);
    return NextResponse.json({ narrative: null }, { status: 200 });
  }
}
