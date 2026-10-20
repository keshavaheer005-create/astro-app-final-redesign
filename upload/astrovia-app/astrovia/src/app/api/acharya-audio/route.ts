import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser, memberGuard } from '@/lib/session';
import { synthesizeDataUri } from '@/lib/tts';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/acharya-audio — body { messageId }
 * Generates (and caches on the ChatMessage row) a spoken WAV of an Acharya
 * reply, so every assistant message can be listened to. Grounded answers are
 * often long, so playback keeps the mentor experience hands-free.
 * → { audioDataUri, cached }
 */
export async function POST(req: Request) {
  try {
    const blocked = await memberGuard('ai');
    if (blocked) return blocked;
    const user = await ensureUser();
    const { messageId } = (await req.json()) as { messageId?: string };
    if (!messageId) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }

    const msg = await db.chatMessage.findFirst({
      where: { id: messageId, userId: user.id, role: 'assistant' },
    });
    if (!msg) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Serve cached audio when present
    if (msg.audioUrl && msg.audioUrl.startsWith('data:audio')) {
      return NextResponse.json({ audioDataUri: msg.audioUrl, cached: true });
    }

    const audioDataUri = await synthesizeDataUri(msg.content, { speed: 0.97, maxChunks: 5 });

    await db.chatMessage.update({
      where: { id: msg.id },
      data: { audioUrl: audioDataUri },
    });

    return NextResponse.json({ audioDataUri, cached: false });
  } catch (e) {
    console.error('[acharya-audio]', e);
    return NextResponse.json({ error: 'tts_failed' }, { status: 500 });
  }
}
