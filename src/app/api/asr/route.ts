import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/asr
 * body { audioBase64: string } — webm/opus (Chrome/Edge) or mp4/aac (Safari)
 * recording from MediaRecorder. Returns { text }.
 * The SDK accepts common audio containers; mediaType is forwarded as a hint.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const audioBase64 = String(body.audioBase64 ?? '');
    if (!audioBase64 || audioBase64.length < 256) {
      return NextResponse.json({ error: 'invalid_audio' }, { status: 400 });
    }
    // ~15MB cap (≈10 min of opus audio) — recordings here are seconds long
    if (audioBase64.length > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'audio_too_large' }, { status: 413 });
    }

    const zai = await ZAI.create();
    const result = await zai.audio.asr.create({ file_base64: audioBase64 });
    const text = (result?.text ?? '').trim();
    if (!text) return NextResponse.json({ error: 'empty_transcript' }, { status: 422 });
    return NextResponse.json({ text });
  } catch (e) {
    console.error('[asr]', e);
    return NextResponse.json({ error: 'asr_failed' }, { status: 500 });
  }
}
