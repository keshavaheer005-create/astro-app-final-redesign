#!/usr/bin/env node
// Benchmarks NVIDIA NIM chat models with a REAL Acharya-style grounded prompt and picks the fastest
// model that still answers well (grounded, no <think> leak, Hindi works).
//
//   node scripts/bench-nim.mjs                 # default candidates
//   node scripts/bench-nim.mjs --models a/b,c/d
//   node scripts/bench-nim.mjs --write         # also writes ACHARYA_MODEL=<winner> into .env
//
// Needs Node 18+ and NVIDIA_API_KEY (from env or .env). Uses ~3 requests per model (limit ≈ 40/min).
import fs from 'node:fs';

const envText = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const fromEnvFile = (k) => (envText.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
const KEY = process.env.NVIDIA_API_KEY || fromEnvFile('NVIDIA_API_KEY');
const BASE = (process.env.NIM_BASE_URL || fromEnvFile('NIM_BASE_URL') || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
if (!KEY) { console.error('NVIDIA_API_KEY is not set (put it in .env).'); process.exit(1); }

const args = process.argv.slice(2);
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const WRITE = args.includes('--write');
const DEFAULTS = [
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.2-3b-instruct',
  'nvidia/nvidia-nemotron-nano-9b-v2',
  'mistralai/mistral-small-3.1-24b-instruct-2503',
  'meta/llama-3.3-70b-instruct',
  'nvidia/llama-3.3-nemotron-super-49b-v1.5',
  'meta/llama-4-maverick-17b-128e-instruct',
  'qwen/qwen3-next-80b-a3b-instruct',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
];
const wanted = (argVal('--models') || '').split(',').map((s) => s.trim()).filter(Boolean);
const RUNS = Number(argVal('--runs') || 3);

const CHART = `Name: Keshav; Born 2010-09-23 07:10 (Asia/Kolkata)
Ascendant: Virgo 14.2°, nakshatra Hasta
Moon sign: Pisces; Sun sign (sidereal): Virgo
Su: Virgo 5.8°, house 1; Mo: Pisces 20.1°, house 7 (Purva Bhadrapada); Ma: Libra 11.3°, house 2; Me: Virgo 21°, house 1
Ju: Pisces 4.0°, house 7 (R); Ve: Libra 15.1°, house 2; Sa: Virgo 12°, house 1 (combust); Ra: Sagittarius 13°, house 4; Ke: Gemini 13°, house 10
Houses: 1 Virgo lord Me (Su Me Sa) | 2 Libra lord Ve (Ma Ve) | 7 Pisces lord Ju (Mo Ju) | 10 Gemini lord Me (Ke)
Current Vimshottari dasha: Mercury mahadasha (until 2027-03-01), Ketu antardasha
Mangal dosha: low (Mars from Lagna h2, from Moon h8, from Venus h1); Sade sati: not active
Current transits: Sa in Pisces (h7 from Lagna, h1 from Moon); Ju in Taurus (h9 from Lagna)`;
const SYSTEM = (lang) => `You are Acharya Abhishek Sharma — a warm, precise Vedic astrologer. Answer ONE person using ONLY the data below; cite the specific placements you used; address them by name; 120-220 words; end with one small practical suggestion. ${lang === 'hi' ? 'Respond in natural Hindi (Devanagari).' : 'Respond in English.'}\nTODAY: Wednesday, 30 September 2026\n\nUSER DATA:\n${CHART}`;
const QUESTIONS = [
  { lang: 'en', q: 'How does my career look this year?' },
  { lang: 'hi', q: 'मेरी शादी कब होगी और उसमें क्या बाधा है?' },
  { lang: 'en', q: 'Is this a good time to change my studies?' },
];

const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function listModels() {
  try {
    const r = await fetch(`${BASE}/models`, { headers });
    if (!r.ok) return null;
    return new Set((await r.json()).data.map((m) => m.id));
  } catch { return null; }
}

async function once(model, { lang, q }) {
  const sys = /nemotron/i.test(model) ? `/no_think\n${SYSTEM(lang)}` : SYSTEM(lang);
  const t0 = performance.now();
  let ttft = null, text = '';
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify({ model, stream: true, max_tokens: 700, temperature: 0.6, top_p: 0.9, messages: [{ role: 'system', content: sys }, { role: 'user', content: q }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  const dec = new TextDecoder(); let buf = '';
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const evt = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = evt.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const d = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (d) { if (ttft === null) ttft = performance.now() - t0; text += d; }
      } catch { /* ignore keep-alives */ }
    }
  }
  const total = performance.now() - t0;
  const clean = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const deva = (clean.match(/[\u0900-\u097F]/g) || []).length;
  const checks = {
    nonEmpty: clean.length > 80,
    noThinkLeak: !/<think>|<\/think>/.test(text),
    grounded: /Virgo|Hasta|Mercury|Jupiter|Ketu|dasha|house|कन्या|बुध|गुरु|केतु|दशा|भाव/i.test(clean),
    language: lang === 'hi' ? deva / Math.max(clean.length, 1) > 0.3 : deva / Math.max(clean.length, 1) < 0.05,
  };
  return { ttft, total, chars: clean.length, ok: Object.values(checks).every(Boolean), checks, sample: clean.slice(0, 140).replace(/\s+/g, ' ') };
}

const available = await listModels();
let candidates = wanted.length ? wanted : DEFAULTS;
if (available) {
  const missing = candidates.filter((m) => !available.has(m));
  if (missing.length) console.log(`(skipping, not in your catalog: ${missing.join(', ')})`);
  candidates = candidates.filter((m) => available.has(m));
} else console.log('(could not list models — trying all candidates anyway)');
if (!candidates.length) { console.error('No candidate models available for this key.'); process.exit(1); }

console.log(`Benchmarking ${candidates.length} model(s), ${RUNS} runs each…\n`);
const rows = [];
for (const model of candidates) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    try { runs.push(await once(model, QUESTIONS[i % QUESTIONS.length])); }
    catch (e) { runs.push({ error: String(e.message || e) }); }
    await sleep(1600); // stay well under 40 req/min
  }
  const good = runs.filter((r) => !r.error);
  const passed = good.filter((r) => r.ok).length;
  rows.push({
    model,
    ttft: median(good.map((r) => r.ttft).filter((x) => x != null)),
    total: median(good.map((r) => r.total)),
    passed, of: runs.length,
    err: runs.find((r) => r.error)?.error,
    sample: good.find((r) => r.ok)?.sample || good[0]?.sample || '',
  });
  const r = rows.at(-1);
  console.log(`${model.padEnd(48)} TTFT ${Number.isNaN(r.ttft) ? '  n/a ' : (r.ttft / 1000).toFixed(2).padStart(5) + 's'}  total ${Number.isNaN(r.total) ? '  n/a ' : (r.total / 1000).toFixed(2).padStart(5) + 's'}  quality ${r.passed}/${r.of}${r.err ? '  ERR ' + r.err : ''}`);
}

const eligible = rows.filter((r) => r.passed >= Math.ceil(r.of * 0.67) && !Number.isNaN(r.total)).sort((a, b) => a.total - b.total);
console.log('\n──────── ranking (quality-gated, fastest complete answer first) ────────');
eligible.forEach((r, i) => console.log(`${i + 1}. ${r.model}  total ${(r.total / 1000).toFixed(2)}s  TTFT ${(r.ttft / 1000).toFixed(2)}s  quality ${r.passed}/${r.of}\n   “${r.sample}…”`));
if (!eligible.length) { console.log('No model passed the quality gate — check your key/catalog.'); process.exit(2); }
const winner = eligible[0].model;
const fastest8 = eligible.find((r) => /(?:^|[^0-9])(1|3|7|8|9)b/i.test(r.model))?.model || winner;
console.log(`\nRecommended:\n  ACHARYA_MODEL=${winner}\n  ACHARYA_FAST_MODEL=${fastest8}`);
if (WRITE) {
  let out = envText;
  const setKey = (k, v) => { out = new RegExp(`^${k}=`, 'm').test(out) ? out.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`) : out.trimEnd() + `\n${k}=${v}\n`; };
  setKey('ACHARYA_MODEL', winner); setKey('ACHARYA_FAST_MODEL', fastest8);
  fs.writeFileSync('.env', out);
  console.log('\nWritten to .env — restart `next dev` to apply.');
}
