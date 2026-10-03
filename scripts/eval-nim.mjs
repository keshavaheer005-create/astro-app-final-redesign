#!/usr/bin/env node
// Speed + ACCURACY evaluation of NVIDIA NIM models on a fixed DEMO chart.
//   node scripts/eval-nim.mjs --list [filter]            # show catalog ids (e.g. --list nemotron)
//   node scripts/eval-nim.mjs [--models nemotron-3-super,nemotron-3-ultra,kimi] [--only 1,2,3] [--write] [--json out.json]
//   add --show to print answers that lost points, --repeat 3 to run every question 3× (less luck)
//   (names may be exact ids OR any part of an id — the closest catalog match is used)
// Every answer is scored automatically against ground-truth facts from the demo chart:
//   · must-have facts (regex groups)        · trap regexes (hallucinations / wrong facts)
//   · language check (Hindi vs English)     · length sanity · no <think> leak
// Needs Node 18+ and NVIDIA_API_KEY (env or .env). Sequential calls (free tier ≈ 40 req/min).
import fs from 'node:fs';

const envText = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const fromEnvFile = (k) => (envText.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
const KEY = process.env.NVIDIA_API_KEY || fromEnvFile('NVIDIA_API_KEY');
const BASE = (process.env.NIM_BASE_URL || fromEnvFile('NIM_BASE_URL') || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
if (!KEY) { console.error('NVIDIA_API_KEY is not set.'); process.exit(1); }

const args = process.argv.slice(2);
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const WRITE = args.includes('--write');
const JSON_OUT = argVal('--json');
const SHOW = args.includes('--show');
const REPEAT = Math.max(1, Number(argVal('--repeat') || 1));
const ONLY = (argVal('--only') || '').split(',').filter(Boolean).map(Number);

// Fragments matched against your live catalog. Default: the two Nemotron 3 models + one strong third pick.
const DEFAULTS = ['nemotron-3-super', 'nemotron-3-ultra'];
const THIRD_PRIORITY = [/kimi-k[23]/i, /deepseek-v[34](?!.*(lite|distill))/i, /qwen3[^/]*(235b|397b|480b|max|next-80b)/i, /glm-[45]/i, /minimax/i, /mistral-(large|medium)/i, /llama-4-maverick/i, /gpt-oss-120b/i];
const wanted = (argVal('--models') || '').split(',').map((s) => s.trim()).filter(Boolean);

// ── DEMO DATA (same layout the app sends: see compactChartContext) ────────────────────────────
const CHART = `Name: Keshav; Born 2010-09-23 07:10 (Asia/Kolkata)
Ascendant: Virgo 14.2°, nakshatra Hasta
Moon sign: Pisces; Sun sign (sidereal): Virgo
Su: Virgo 5.8°, house 1, nakshatra Uttara Phalguni
Mo: Pisces 20.1°, house 7, nakshatra Purva Bhadrapada
Ma: Libra 11.3°, house 2, nakshatra Chitra
Me: Virgo 21.0°, house 1, nakshatra Hasta
Ju: Pisces 4.0°, house 7, nakshatra Purva Bhadrapada (R)
Ve: Libra 15.1°, house 2, nakshatra Swati
Sa: Virgo 12.0°, house 1, nakshatra Hasta (combust)
Ra: Sagittarius 13.0°, house 4, nakshatra Mula
Ke: Gemini 13.0°, house 10, nakshatra Ardra
Houses (whole-sign; house: sign, lord, occupants):
  1: Virgo, lord Me, Su Me Sa(combust)
  2: Libra, lord Ve, Ma Ve
  3: Scorpio, lord Ma
  4: Sagittarius, lord Ju, Ra
  5: Capricorn, lord Sa
  6: Aquarius, lord Sa
  7: Pisces, lord Ju, Mo Ju(R)
  8: Aries, lord Ma
  9: Taurus, lord Ve
  10: Gemini, lord Me, Ke
  11: Cancer, lord Mo
  12: Leo, lord Su
Current Vimshottari dasha: Mercury mahadasha (until 2027-03-01), Ketu antardasha (until 2026-11-14)
Mangal dosha: low (Mars from Lagna h2, from Moon h8, from Venus h1); Sade sati: active (peak)
Current transits (2026-09-30): Su in Virgo (h1 from Lagna, h7 from Moon); Mo in Cancer; Ma in Leo; Me in Virgo; Ju in Gemini (h10 from Lagna); Ve in Libra; Sa in Pisces (h7 from Lagna, h1 from Moon); Ra in Aquarius; Ke in Leo.`;
const JOURNAL = `2026-09-29: mood 2/5, energy 2/5 (during Mercury mahadasha, Ketu antardasha) — note: "argued with my best friend, felt misunderstood"
2026-09-28: mood 3/5, energy 3/5 — note: "slow day, lots of homework"
2026-09-27: mood 4/5, energy 4/5`;
const system = (lang) => `You are Acharya Abhishek Sharma — a warm, precise Vedic astrologer speaking to ONE person whose verified data is below. Method: work out the life area of the question, use the relevant houses, lords, occupants, dasha and transits from the data, cite the specific placements you used, and if the data does not contain something, say so instead of inventing it. Address the person by name. Never produce a generic horoscope. 120-220 words. ${lang === 'hi' ? 'Respond in natural, warm Hindi (Devanagari script).' : 'Respond in English (Sanskrit terms with a short gloss).'}

TODAY: Wednesday, 30 September 2026 (Asia/Kolkata)
PERSON: Name: Keshav; age 16; born in Abohar, Punjab; prefers ${lang === 'hi' ? 'Hindi' : 'English'}

USER DATA (verified Swiss Ephemeris computations, Lahiri ayanamsa, whole-sign houses):
${CHART}

KARMA JOURNAL (recent daily check-ins, most recent first):
${JOURNAL}`;

// ── QUESTIONS with ground truth. each `must` group = at least one regex must match; each `trap` must NOT match.
const HEDGE = /not (listed|available|included|provided|part of|appear|shown|present|mentioned|visible|in (the|your) (data|chart))|no (data|information|uranus|outer)|don'?t have|do not have|does not (include|contain|show|appear|list)|doesn'?t (include|contain|show|appear|list)|cannot see|can'?t see|isn'?t (listed|included|shown|present)|aren'?t (listed|included)|outer planets?|nine (classical )?grahas|नहीं|उपलब्ध/i;
const Q = [
  { id: 1, lang: 'en', q: 'How does my career look?', must: [/10th|tenth|house 10|Gemini/i, /Mercury/i, /Ketu/i], trap: [/Saturn (is )?(placed )?in (the )?(10th|tenth)/i, /Ascendant is (Leo|Libra|Aries|Pisces)/i] },
  { id: 2, lang: 'hi', q: 'मेरी शादी और रिश्तों के बारे में बताइए।', must: [/सातव|7वें|7th|मीन/, /गुरु|बृहस्पति|ब्रहस्पति|Jupiter/i, /चंद्र|चन्द्र|चांद|Moon/i], trap: [/सातवें भाव में (शनि|राहु|केतु)/, /कर्क लग्न|तुला लग्न/] },
  { id: 3, lang: 'en', q: 'Do I have Mangal dosha, and how serious is it?', must: [/low|mild|minor|partial/i, /Mars/i, /(2nd|second|house 2|h2)/i], trap: [/(?<!\bnot (?:a |an )?)\bhigh (?:mangal|manglik|dosha)/i, /\b(?:no|not have any) mangal/i, /(?<!\bnot (?:a |an )?)(?:severe|strong|serious|intense) (?:mangal|manglik|dosha)/i] },
  { id: 4, lang: 'en', q: 'Which dasha am I in right now and when does it end?', must: [/Mercury|Budh/i, /Ketu/i, /2027|March/i], trap: [/(Venus|Saturn|Sun|Moon|Mars|Rahu|Jupiter) mahadasha/i, /mahadasha (of|is) (Venus|Saturn|Sun|Moon|Mars|Rahu|Jupiter)/i] },
  { id: 5, lang: 'en', q: "Is Saturn's transit affecting me right now?", must: [/Saturn/i, /Pisces/i, /Sade Sati|sade sati|peak|first house from (the )?Moon|Moon/i], trap: [/Sade Sati (is )?not (active|running)/i, /Saturn (is )?(currently )?(in|transiting) (Aries|Leo|Virgo|Capricorn|Aquarius)/i] },
  { id: 6, lang: 'en', q: 'What does my Uranus placement say about me?', must: [HEDGE], trap: [/Uranus (is )?(placed |located )?in (Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)/i] },
  { id: 7, lang: 'hi', q: 'मेरे स्वास्थ्य के बारे में क्या दिख रहा है?', must: [/लग्न|पहले भाव|प्रथम/, /कन्या|शनि|Saturn/i], trap: [/लग्न (मेष|वृषभ|मिथुन|कर्क|सिंह|तुला|वृश्चिक|धनु|मकर|कुंभ|मीन)/, /मेष लग्न|तुला लग्न/] },
  { id: 8, lang: 'en', q: 'Why have I been feeling low this week?', must: [/argu|friend|misunderstood|journal|mood/i, /Saturn|Sade Sati|Ketu|Moon/i], trap: [/Ascendant is (Leo|Libra|Aries|Pisces)/i] },
];

// ── plumbing ─────────────────────────────────────────────────────────────────
const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (a) => { const s = a.filter((x) => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const fmt = (ms) => (Number.isNaN(ms) ? '  n/a ' : (ms / 1000).toFixed(2).padStart(5) + 's');

async function listModels() {
  const r = await fetch(`${BASE}/models`, { headers, signal: AbortSignal.timeout(20_000) });
  if (r.status === 401 || r.status === 403) throw new Error(`Key rejected (HTTP ${r.status}).`);
  if (!r.ok) throw new Error(`Could not list models (HTTP ${r.status}).`);
  return new Set((await r.json()).data.map((m) => m.id));
}

// Thinking models burn the token budget on hidden reasoning. Try to switch it off per family;
// if the server rejects the extra field (HTTP 400) we fall back to a plain request.
const thinkingOff = (model) => {
  if (/nemotron/i.test(model)) return [{ chat_template_kwargs: { enable_thinking: false } }, {}];
  if (/gpt-oss/i.test(model)) return [{ reasoning_effort: 'low' }, {}];
  if (/deepseek|kimi|qwen3|glm|minimax/i.test(model)) return [{ chat_template_kwargs: { thinking: false, enable_thinking: false } }, {}];
  return [{}];
};
const variantUsed = new Map();

async function ask(model, { lang, q }) {
  const sys = /nemotron/i.test(model) ? `/no_think\n${system(lang)}` : system(lang);
  const variants = thinkingOff(model);
  let startAt = variantUsed.get(model) ?? 0, lastErr;
  for (let vi = startAt; vi < variants.length; vi++) {
    const t0 = performance.now();
    let ttft = null, firstAny = null, text = '', reasoning = 0;
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST', headers,
      body: JSON.stringify({ model, stream: true, max_tokens: 1400, temperature: 0.4, top_p: 0.9, messages: [{ role: 'system', content: sys }, { role: 'user', content: q }], ...variants[vi] }),
      signal: AbortSignal.timeout(120_000),
    });
    if (res.status === 400 && vi < variants.length - 1) { lastErr = (await res.text()).slice(0, 120); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 140)}`);
    variantUsed.set(model, vi);
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
          const d = JSON.parse(payload)?.choices?.[0]?.delta;
          const r = d?.reasoning_content ?? d?.reasoning;
          if (r) { reasoning += r.length; if (firstAny === null) firstAny = performance.now() - t0; }
          if (d?.content) { if (ttft === null) ttft = performance.now() - t0; if (firstAny === null) firstAny = ttft; text += d.content; }
        } catch { /* keep-alive */ }
      }
    }
    return { ttft, total: performance.now() - t0, raw: text, reasoning, thinkingOff: vi === 0 && Object.keys(variants[0]).length > 0 };
  }
  throw new Error(`HTTP 400 ${lastErr || ''}`);
}

function score(item, raw) {
  const clean = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean).length;
  const deva = (clean.match(/[\u0900-\u097F]/g) || []).length / Math.max(clean.length, 1);
  const factHits = item.must.map((re) => re.test(clean));
  const trapHits = item.trap.filter((re) => re.test(clean));
  const langOk = item.lang === 'hi' ? deva > 0.3 : deva < 0.05;
  const lenOk = words >= 50 && words <= 380;
  const leak = /<think>|<\/think>/.test(raw);
  const facts = factHits.filter(Boolean).length / item.must.length;
  // 70% facts, 15% language, 5% length, 10% no-trap; any trap or leak caps the item at 0.5
  let s = 0.7 * facts + 0.15 * (langOk ? 1 : 0) + 0.05 * (lenOk ? 1 : 0) + 0.1 * (trapHits.length ? 0 : 1);
  if (trapHits.length || leak || clean.length === 0) s = Math.min(s, 0.5);
  if (clean.length === 0) s = 0;
  return { s, facts: factHits, traps: trapHits.map(String), langOk, lenOk, leak, words, text: clean };
}

// ── run ──────────────────────────────────────────────────────────────────────
let available;
try { available = await listModels(); } catch (e) { console.error('✖ ' + e.message); process.exit(1); }
console.log(`✔ Key accepted. Catalog has ${available.size} models.\n`);
if (args.includes('--list')) {
  const f = args[args.indexOf('--list') + 1];
  const ids = [...available].sort().filter((id) => !f || f.startsWith('--') || id.toLowerCase().includes(f.toLowerCase()));
  console.log(ids.join('\n')); process.exit(0);
}
const resolve = (name) => {
  if (available.has(name)) return name;
  const hits = [...available].filter((id) => id.toLowerCase().includes(name.toLowerCase())).sort((x, y) => x.length - y.length);
  return hits[0] || null;
};
let candidates = [];
for (const name of (wanted.length ? wanted : DEFAULTS)) {
  const id = resolve(name);
  console.log(id ? `✔ "${name}" → ${id}` : `✖ "${name}" matches nothing in your catalog (try: node scripts/eval-nim.mjs --list ${name.split(/[-/]/)[0]})`);
  if (id && !candidates.includes(id)) candidates.push(id);
}
if (!wanted.length) { // auto-pick a strong third model
  for (const re of THIRD_PRIORITY) {
    const id = [...available].sort((x, y) => y.length - x.length).find((m) => re.test(m) && !candidates.includes(m));
    if (id) { console.log(`✔ third pick (auto) → ${id}`); candidates.push(id); break; }
  }
}
console.log('');
if (!candidates.length) { console.error('Nothing to test. Run with --list to see model ids.'); process.exit(1); }
const baseQs = ONLY.length ? Q.filter((x) => ONLY.includes(x.id)) : Q;
const questions = baseQs.flatMap((q) => Array(REPEAT).fill(q));

const results = [];
for (const model of candidates) {
  const per = [];
  process.stdout.write(`▶ ${model}\n`);
  for (const item of questions) {
    try {
      const r = await ask(model, item);
      const sc = score(item, r.raw);
      per.push({ id: item.id, lang: item.lang, ttft: r.ttft, total: r.total, ...sc });
      if (SHOW && sc.s < 1) console.log(`      ┌ answer (score ${sc.s.toFixed(2)}): ${sc.text.replace(/\s+/g, ' ').slice(0, 600)}\n      └ facts hit: ${sc.facts.map((h, i) => (h ? '✔' : '✘') + (i + 1)).join(' ')}${sc.traps.length ? '  traps: ' + sc.traps.join(', ') : ''}`);
      per.at(-1).reasoning = r.reasoning; per.at(-1).thinkingOff = r.thinkingOff;
      const emptyThink = !sc.text && r.reasoning > 0;
      process.stdout.write(`   Q${item.id} ${item.lang}  ${sc.s.toFixed(2)}  TTFT ${fmt(r.ttft)}  total ${fmt(r.total)}${r.reasoning ? `  (thought ${r.reasoning} chars)` : ''}${emptyThink ? '  EMPTY: ran out of tokens while thinking' : ''}${sc.traps.length ? '  TRAP!' : ''}${sc.leak ? '  <think>-leak' : ''}${sc.facts.every(Boolean) || !sc.text ? '' : '  missing:' + sc.facts.map((h, i) => (h ? '' : i + 1)).join('')}\n`);
    } catch (e) {
      per.push({ id: item.id, lang: item.lang, s: 0, error: String(e.message || e) });
      process.stdout.write(`   Q${item.id} ${item.lang}  ERROR ${String(e.message || e).slice(0, 100)}\n`);
      if (/HTTP (401|403|404)/.test(String(e.message))) break; // no point continuing with this model
    }
    await sleep(1700);
  }
  const ok = per.filter((p) => !p.error);
  results.push({
    model,
    accuracy: per.reduce((a, p) => a + p.s, 0) / questions.length,
    ttft: median(ok.map((p) => p.ttft)), total: median(ok.map((p) => p.total)),
    errors: per.filter((p) => p.error).length, per,
  });
  const r = results.at(-1);
  console.log(`   ⇒ accuracy ${(r.accuracy * 100).toFixed(0)}%  median TTFT ${fmt(r.ttft)}  median total ${fmt(r.total)}\n`);
}

// ── verdict ──────────────────────────────────────────────────────────────────
const usable = results.filter((r) => r.errors <= 1 && !Number.isNaN(r.total));
const byAcc = [...usable].sort((a, b) => b.accuracy - a.accuracy || a.total - b.total);
const best = byAcc[0];
const goodEnough = usable.filter((r) => r.accuracy >= Math.max(0.75, (best?.accuracy ?? 0) - 0.08)).sort((a, b) => a.total - b.total);
console.log('══════════ RESULTS (accuracy on demo chart · speed) ══════════');
console.log('model'.padEnd(46) + 'accuracy  TTFT     total');
[...results].sort((a, b) => b.accuracy - a.accuracy).forEach((r) => console.log(r.model.padEnd(46) + `${(r.accuracy * 100).toFixed(0).padStart(5)}%   ${fmt(r.ttft)}  ${fmt(r.total)}${r.errors ? `   (${r.errors} errors)` : ''}`));
if (!best) { console.log('\nNo model produced usable answers.'); process.exit(2); }
const fast = goodEnough[0] || best;
console.log(`\n★ MOST ACCURATE : ${best.model}  (${(best.accuracy * 100).toFixed(0)}%, ${fmt(best.total).trim()})`);
console.log(`⚡ FASTEST GOOD  : ${fast.model}  (${(fast.accuracy * 100).toFixed(0)}%, ${fmt(fast.total).trim()})   ← recommended ACHARYA_MODEL`);
const tiny = usable.filter((r) => r.accuracy >= 0.6).sort((a, b) => a.total - b.total)[0];
if (tiny) console.log(`✦ QUICK NOTES    : ${tiny.model}  (${(tiny.accuracy * 100).toFixed(0)}%, ${fmt(tiny.total).trim()})   ← recommended ACHARYA_FAST_MODEL`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ when: new Date().toISOString(), best: best.model, fast: fast.model, results }, null, 2));
if (WRITE) {
  let out = envText;
  const setKey = (k, v) => { out = new RegExp(`^${k}=`, 'm').test(out) ? out.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`) : out.trimEnd() + `\n${k}=${v}\n`; };
  setKey('ACHARYA_MODEL', fast.model); if (tiny) setKey('ACHARYA_FAST_MODEL', tiny.model);
  fs.writeFileSync('.env', out); console.log('\nWritten to .env.');
}
