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
  console.log('type:', upstream?.constructor?.name);
  console.log('has getReader:', typeof (upstream as any)?.getReader === 'function');
  console.log('has asyncIterator:', typeof (upstream as any)?.[Symbol.asyncIterator] === 'function');
  console.log('keys:', Object.keys(upstream ?? {}).slice(0, 8));
  // Try consuming as async iterable
  let text = '';
  for await (const chunk of upstream as any) {
    const d = chunk?.choices?.[0]?.delta?.content ?? '';
    text += d;
  }
  console.log('streamed text:', text);
}

main().catch((e) => {
  console.error('STREAM TEST FAILED:', e?.message ?? e);
  process.exit(1);
});
