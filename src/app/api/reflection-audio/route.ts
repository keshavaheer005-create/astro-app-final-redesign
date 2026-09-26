import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/session';
import ZAI from 'z-ai-web-dev-sdk';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/reflection-audio
 * Generates (and caches in DB) a spoken MP3 of this week's Acharya letter.
 * Long text is chunked (<1024 chars) and MP3 frames are concatenated.
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

    const zai = await ZAI.create();

    // Chunk by sentence under the 1024-char limit
    const text = reflection.reflectionText.replace(/\s+/g, ' ').trim();
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let current = '';
    for (const s of sentences) {
      if ((current + s).length <= 950) current += s;
      else {
        if (current) chunks.push(current.trim());
        current = s;
      }
    }
    if (current) chunks.push(current.trim());

    const buffers: Buffer[] = [];
    for (const chunk of chunks.slice(0, 3)) {
      const response = await zai.audio.tts.create({
        input: chunk,
        voice: 'tongtong',
        speed: 0.95,
        response_format: 'wav',
        stream: false,
      });
      const arrayBuffer = await response.arrayBuffer();
      buffers.push(Buffer.from(new Uint8Array(arrayBuffer)));
    }

    // Merge WAV chunks: extract PCM payloads and rewrite a single RIFF header
    const pcmParts = buffers.map((b) => extractWavPcm(b)).filter((p) => p.length > 0);
    if (pcmParts.length === 0) throw new Error('tts returned no audio');
    const wav = buildWav(Buffer.concat(pcmParts), 24000, 1, 16);
    const dataUri = `data:audio/wav;base64,${wav.toString('base64')}`;

    await db.weeklyReflection.update({
      where: { id: reflection.id },
      data: { audioUrl: dataUri },
    });

    return NextResponse.json({ audioDataUri: dataUri, cached: false });
  } catch (e) {
    console.error('[reflection-audio]', e);
    return NextResponse.json({ error: 'tts_failed' }, { status: 500 });
  }
}

/** Extract the PCM payload from a RIFF/WAVE buffer (walks chunks, handles alignment). */
function extractWavPcm(buf: Buffer): Buffer {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    return buf; // not a WAV header — return raw as fallback
  }
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') {
      const end = Math.min(off + 8 + size, buf.length);
      return buf.subarray(off + 8, end);
    }
    off += 8 + size + (size % 2);
  }
  return Buffer.alloc(0);
}

/** Build a canonical 16-bit PCM WAV header around raw PCM data. */
function buildWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
