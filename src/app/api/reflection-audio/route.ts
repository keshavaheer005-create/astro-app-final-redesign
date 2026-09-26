import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/session';
import { synthesizeDataUri } from '@/lib/tts';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/reflection-audio
 * Generates (and caches in DB) a spoken WAV of this week's Acharya letter.
 * → { audioDataUri } playable directly in <audio src=…>
 */
export async function POST() {
  try {
    const user = await ensureUser();
    const reflection = await db.weeklyReflection.findFirst({
      where: { userId: user.id },
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
