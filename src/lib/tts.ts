// Backend-only TTS helpers (z-ai-web-dev-sdk). Never import from client code.
//
// Long text is chunked by sentence under the 1024-char SDK limit; each chunk is
// synthesized as WAV and the PCM payloads are merged into ONE canonical RIFF
// file so playback is gapless.

import ZAI from 'z-ai-web-dev-sdk';

const MAX_CHUNK = 950; // safety margin below the 1024-char limit

/** Split text into sentence-based chunks under MAX_CHUNK chars. */
export function chunkForTts(text: string, maxChunks = 4): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length <= MAX_CHUNK) {
      current += s;
    } else {
      if (current.trim()) chunks.push(current.trim());
      current = s.length > MAX_CHUNK ? s.slice(0, MAX_CHUNK) : s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.slice(0, maxChunks);
}

/** Extract the PCM payload from a RIFF/WAVE buffer (walks chunks, handles alignment). */
export function extractWavPcm(buf: Buffer): Buffer {
  if (
    buf.length < 44 ||
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WAVE'
  ) {
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
export function buildWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
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

/**
 * Synthesize speech → single gapless WAV Buffer.
 * voice: 'tongtong' (warm female) works well for both EN + HI.
 */
export async function synthesizeWav(
  text: string,
  opts: { voice?: string; speed?: number; maxChunks?: number } = {},
): Promise<Buffer> {
  const zai = await ZAI.create();
  const chunks = chunkForTts(text, opts.maxChunks ?? 4);
  if (chunks.length === 0) throw new Error('tts_empty_text');

  const pcmParts: Buffer[] = [];
  for (const chunk of chunks) {
    const response = await zai.audio.tts.create({
      input: chunk,
      voice: opts.voice ?? 'tongtong',
      speed: opts.speed ?? 0.95,
      response_format: 'wav',
      stream: false,
    });
    const arrayBuffer = await response.arrayBuffer();
    const pcm = extractWavPcm(Buffer.from(new Uint8Array(arrayBuffer)));
    if (pcm.length > 0) pcmParts.push(pcm);
  }
  if (pcmParts.length === 0) throw new Error('tts_returned_no_audio');

  // All chunks share the TTS engine's fixed output format (24 kHz mono 16-bit)
  return buildWav(Buffer.concat(pcmParts), 24000, 1, 16);
}

/** Synthesize speech → data URI usable directly in <audio src>. */
export async function synthesizeDataUri(
  text: string,
  opts: { voice?: string; speed?: number; maxChunks?: number } = {},
): Promise<string> {
  const wav = await synthesizeWav(text, opts);
  return `data:audio/wav;base64,${wav.toString('base64')}`;
}
