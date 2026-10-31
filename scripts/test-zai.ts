import ZAI from 'z-ai-web-dev-sdk';

async function main() {
  console.log('creating ZAI...');
  const zai = await ZAI.create();
  console.log('calling chat...');
  const start = Date.now();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: 'You are a test oracle. Reply with exactly: OK-SATURN' },
      { role: 'user', content: 'ping' },
    ],
    thinking: { type: 'disabled' },
  });
  console.log('elapsed ms:', Date.now() - start);
  console.log('content:', completion.choices[0]?.message?.content);
}

main().catch((e) => {
  console.error('ZAI TEST FAILED:', e?.message ?? e);
  process.exit(1);
});
