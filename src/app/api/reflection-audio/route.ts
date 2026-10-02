import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/session';
import { getActiveChart } from '@/lib/active-chart';
import { synthesizeDataUri } from '@/lib/tts';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/reflection-audio
 * Generates (and caches in DB) a spoken WAV of this week's Acharya letter.
 * → { audioDataUri } playable directly in <audio src=…>
 */
export async function POST(req: Request) {
  try {
    const user = await ensureUser();
    // Optional language filter — the Home letter card shows the letter matching
    // the active UI language; audio must match what is displayed.
    let language: string | null = null;
    try {
      const body = await req.json();
      if (body?.language === 'hi' || body?.language === 'en') language = body.language;
    } catch {
      /* no body — pick latest */
    }
    const active = await getActiveChart(user.id);
    if (!active) return NextResponse.json({ error: 'no_reflection' }, { status: 404 });
    const reflection = await db.weeklyReflection.findFirst({
      where: { chartId: active.id, ...(language ? { language } : {}) },
      orderBy: { weekStartDate: 'desc' },
    });
    if (!reflection) {
      return NextResponse.json({ error: 'no_reflection' }, { status: 404 });
    }

    // Serve cached audio when present
    if (reflection.audioUrl && reflection.audioUrl.startsWith('data:audio')) {
      return NextResponse.json({ audioDataUri: reflection.audioUrl, cached: true });
    }

    const audioDataUri = await synthesizeDataUri(reflection.reflectionText, { speed: 0.95 });

    await db.weeklyReflection.update({
      where: { id: reflection.id },
      data: { audioUrl: audioDataUri },
    });

    return NextResponse.json({ audioDataUri, cached: false });
  } catch (e) {
    console.error('[reflection-audio]', e);
    return NextResponse.json({ error: 'tts_failed' }, { status: 500 });
  }
}
