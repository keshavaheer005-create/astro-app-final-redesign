import { NextResponse } from 'next/server';
import { festivalSignificance } from '@/lib/ai';

export const runtime = 'nodejs';

const VALID_KINDS = new Set(['festival', 'ekadashi', 'sankranti']);

// Small in-process cache — festival significance is user-independent,
// so one generation per (kind|name|language) serves everyone.
const cache = new Map<string, string>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const kind = typeof body?.kind === 'string' && VALID_KINDS.has(body.kind) ? body.kind : 'festival';
    const language = body?.language === 'hi' ? 'hi' : 'en';
    const anchor = typeof body?.anchor === 'string' ? body.anchor.trim().slice(0, 60) : undefined;
    if (!name) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

    const key = `${kind}|${name}|${language}`;
    const hit = cache.get(key);
    if (hit) return NextResponse.json({ text: hit, cached: true });

    const text = await festivalSignificance({ name, kind: kind as 'festival' | 'ekadashi' | 'sankranti', language, anchor });
    cache.set(key, text);
    return NextResponse.json({ text, cached: false });
  } catch (e) {
    console.error('[festival-detail]', e);
    return NextResponse.json({ error: 'festival_detail_failed' }, { status: 500 });
  }
}
