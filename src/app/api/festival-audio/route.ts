import { NextResponse } from 'next/server';
import { memberGuard } from '@/lib/session';
import { synthesizeDataUri } from '@/lib/tts';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/festival-audio  { kind, name, language, text }
 * Spoken version of a festival/parva significance note (text already generated
 * by /api/festival-detail and cached client-side). The synthesis result is
 * cached in-process per (kind|name|language|text-hash) so repeat listens are
 * instant and identical text never re-synthesizes across visitors.
 */

const VALID_KINDS = new Set(['festival', 'ekadashi', 'sankranti']);

const MAX_TEXT = 1200; // festival notes are 70–120 words; hard cap for safety
const CACHE_CAP = 40;

// LRU-ish in-process cache (insertion-ordered Map; oldest evicted)
const cache = new Map<string, string>();

function hashText(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function POST(req: Request) {
  try {
    const blocked = await memberGuard('ai');
    if (blocked) return blocked;
    const body = await req.json();
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const kind = typeof body?.kind === 'string' && VALID_KINDS.has(body.kind) ? body.kind : 'festival';
    const language = body?.language === 'hi' ? 'hi' : 'en';
    const text = typeof body?.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
    if (!name || !text) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

    const key = `${language}|${kind}|${name}|${hashText(text)}`;
    const hit = cache.get(key);
    if (hit) {
      // refresh recency
      cache.delete(key);
      cache.set(key, hit);
      return NextResponse.json({ audioDataUri: hit, cached: true });
    }

    const audioDataUri = await synthesizeDataUri(text, { speed: 0.95 });
    cache.set(key, audioDataUri);
    if (cache.size > CACHE_CAP) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    return NextResponse.json({ audioDataUri, cached: false });
  } catch (e) {
    console.error('[festival-audio]', e);
    return NextResponse.json({ error: 'tts_failed' }, { status: 500 });
  }
}
