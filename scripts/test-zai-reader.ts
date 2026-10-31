import ZAI from 'z-ai-web-dev-sdk';

async function main() {
  const zai = await ZAI.create();
  const upstream = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: 'Reply with exactly: OK-STREAM' },
      { role: 'user', content: 'ping' },
    ],
    stream: true,
    thinking: { type: 'disabled' },
  });
  const reader = (upstream as ReadableStream<Uint8Array>).getReader();
  const dec = new TextDecoder();
  let raw = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += dec.decode(value, { stream: true });
    if (raw.length > 4000) break;
  }
  console.log('RAW CHUNKS (first 1200 chars):');
  console.log(raw.slice(0, 1200));
}

main().catch((e) => {
  console.error('READER TEST FAILED:', e?.message ?? e);
  process.exit(1);
});
