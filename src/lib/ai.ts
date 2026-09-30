// Backend-only Acharya AI (z-ai-web-dev-sdk). Never import from client code.
import ZAI from 'z-ai-web-dev-sdk';

export const ACHARYA_NAME = 'Acharya Abhishek Sharma';

const PERSONA = `You are ${ACHARYA_NAME} — a warm, precise, wise Vedic astrologer and mentor with 20 years of practice in Parashari jyotish. You speak with calm authority and genuine care, never fatalism. You explain planetary influences in plain, encouraging language and always end with one small practical suggestion. You never give medical, legal or financial guarantees; you frame astrology as a lens for self-understanding and timing.`;

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

let cachedZai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZai() {
  if (!cachedZai) cachedZai = await ZAI.create();
  return cachedZai;
}

async function complete(messages: ChatTurn[], system: string): Promise<string | null> {
  try {
    const zai = await getZai();
    const completion = await zai.chat.completions.create({
      messages: [{ role: 'assistant', content: system } as ChatTurn, ...messages].slice(-21),
      thinking: { type: 'disabled' },
    });
    const text = completion.choices[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch (err) {
    console.error('[ai] completion failed:', (err as Error).message);
    return null;
  }
}

/** Acharya chat — grounded strictly in the provided chart + journal context. */
function acharyaSystem(opts: {
  chartContext: string;
  journalContext: string;
  language: 'en' | 'hi';
}): string {
  const langRule =
    opts.language === 'hi'
      ? 'Respond in natural, warm Hindi (Devanagari script). Use everyday Hindi with light Sanskrit terms where natural.'
      : 'Respond in English (you may use Sanskrit terms with a short gloss).';
  return `${PERSONA}

You are answering inside the "Self Sage" app. Ground every answer in the USER DATA below — cite specific placements, dasha periods or journal entries. If the data does not support a claim, say what the chart actually shows instead of inventing details. Never produce a generic horoscope. Keep answers 120-220 words. ${langRule}

USER DATA (verified Swiss Ephemeris computations, Lahiri ayanamsa):
${opts.chartContext}

KARMA JOURNAL (recent daily check-ins, most recent first):
${opts.journalContext || 'No journal entries yet.'}`;
}

export async function acharyaReply(opts: {
  question: string;
  chartContext: string;
  journalContext: string;
  history: ChatTurn[];
  language: 'en' | 'hi';
}): Promise<string> {
  const system = acharyaSystem(opts);
  const llm = await complete(
    [...opts.history.slice(-8), { role: 'user', content: opts.question }],
    system,
  );
  if (llm) return llm;

  // Deterministic fallback so the chat never hard-fails
  if (opts.language === 'hi') {
    return `क्षमा करें, इस समय मैं आपकी कुंडली से पूरी तरह जुड़ नहीं पा रहा हूँ। कृपया कुछ क्षण बाद पुनः प्रयास करें — तब तक अपनी श्वास पर ध्यान दें और आज के कर्म पर ध्यान केंद्रित रखें।`;
  }
  return 'Forgive me — I could not reach my ephemeris just now. Please try again in a moment; meanwhile, anchor yourself with three slow breaths and let today\u2019s actions, not anxieties, lead.';
}

/**
 * Acharya chat with token streaming. Returns a SSE wire stream for the browser
 * (`data: {"v":"chunk"}\n\n` … `data: {}` end) plus a `done` promise resolving
 * with the FULL reply text so the caller can persist it after the stream ends.
 * Falls back to a single-chunk stream when upstream streaming is unavailable.
 */
export async function acharyaStreamReply(opts: {
  question: string;
  chartContext: string;
  journalContext: string;
  history: ChatTurn[];
  language: 'en' | 'hi';
}): Promise<{ stream: ReadableStream<Uint8Array>; done: Promise<string> }> {
  const enc = new TextEncoder();
  const system = acharyaSystem(opts);
  const turns: ChatTurn[] = [...opts.history.slice(-8), { role: 'user', content: opts.question }];

  let resolveDone!: (v: string) => void;
  let rejectDone!: (e: unknown) => void;
  const done = new Promise<string>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });

  const sse = (obj: unknown) => enc.encode(`data: ${JSON.stringify(obj)}\n\n`);

  const pumpUpstream = (upstream: ReadableStream<Uint8Array>, controller: ReadableStreamDefaultController<Uint8Array>, full: { text: string }) => {
    const dec = new TextDecoder();
    const reader = upstream.getReader();
    let buf = '';
    const handleEvent = (raw: string) => {
      const line = raw.split('\n').filter((l) => l.startsWith('data:'))[0];
      if (!line) return;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') return;
      let delta = '';
      try {
        const obj = JSON.parse(payload);
        delta =
          obj?.choices?.[0]?.delta?.content ??
          obj?.choices?.[0]?.message?.content ??
          obj?.choices?.[0]?.text ??
          obj?.delta?.content ??
          obj?.delta?.text ??
          obj?.content ??
          '';
      } catch {
        // upstream sent a bare text line — surface it verbatim
        delta = payload;
      }
      if (delta) {
        full.text += delta;
        controller.enqueue(sse({ v: delta }));
      }
    };
    const readLoop = async () => {
      try {
        for (;;) {
          const { done: up, value } = await reader.read();
          if (up) break;
          buf += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf('\n\n')) >= 0) {
            const evt = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 2);
            if (evt) handleEvent(evt);
          }
        }
        // trailing buffered event without terminator
        const tail = buf.trim();
        if (tail) handleEvent(tail);
        controller.close();
        resolveDone(full.text);
      } catch (e) {
        try { controller.close(); } catch { /* already closed */ }
        rejectDone(e);
      }
    };
    void readLoop();
  };

  try {
    const zai = await getZai();
    const upstream: unknown = await zai.chat.completions.create({
      messages: [{ role: 'assistant', content: system } as ChatTurn, ...turns].slice(-21),
      stream: true,
      thinking: { type: 'disabled' },
    });

    if (upstream && typeof (upstream as ReadableStream).getReader === 'function') {
      const full = { text: '' };
      const wire = new ReadableStream<Uint8Array>({
        start(controller) {
          pumpUpstream(upstream as ReadableStream<Uint8Array>, controller, full);
        },
        cancel() {
          try { (upstream as ReadableStream).cancel(); } catch { /* */ }
          rejectDone(new Error('client_cancelled'));
        },
      });
      return { stream: wire, done };
    }

    // Upstream ignored `stream` and returned a plain JSON completion
    const text =
      (upstream as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content?.trim() ?? '';
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        if (text) controller.enqueue(sse({ v: text }));
        controller.close();
        resolveDone(text);
      },
    });
    return { stream, done };
  } catch (err) {
    console.error('[ai] stream failed, using fallback:', (err as Error).message);
    const fallback = opts.language === 'hi'
      ? 'क्षमा करें, इस समय मैं आपकी कुंडली से पूरी तरह जुड़ नहीं पा रहा हूँ। कृपया कुछ क्षण बाद पुनः प्रयास करें — तब तक अपनी श्वास पर ध्यान दें और आज के कर्म पर ध्यान केंद्रित रखें।'
      : 'Forgive me — I could not reach my ephemeris just now. Please try again in a moment; meanwhile, anchor yourself with three slow breaths and let today\u2019s actions, not anxieties, lead.';
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(sse({ v: fallback }));
        controller.close();
        resolveDone(fallback);
      },
    });
    return { stream, done };
  }
}

/** Weekly reflection letter — must reference at least one specific logged note. */
export async function weeklyReflection(opts: {
  name: string;
  language: 'en' | 'hi';
  dashaContext: string;
  checkins: { date: string; mood: number; energy: number | null; note: string | null }[];
}): Promise<string | null> {
  const notes = opts.checkins.filter((c) => c.note && c.note.trim().length > 2);
  const langRule = opts.language === 'hi'
    ? 'Write the letter in warm, natural Hindi (Devanagari).'
    : 'Write the letter in English.';
  const system = `You are ${ACHARYA_NAME}. Write a short weekly reflection letter (140-200 words) to the user. Address them by name. Reference their real logged mood/energy pattern and quote or allude to AT LEAST ONE specific journal note verbatim or near-verbatim. Weave in the dasha context. End with one gentle practice for next week. No bullet points, flowing letter prose, sign off as "— ${ACHARYA_NAME}". ${langRule}`;
  const user = `USER: ${opts.name}
DASHA CONTEXT: ${opts.dashaContext}
WEEK'S CHECK-INS: ${JSON.stringify(opts.checkins)}
NOTES QUOTABLE: ${JSON.stringify(notes.slice(0, 4))}`;
  return complete([{ role: 'user', content: user }], system);
}

/** Decision timing — verdict phrased from real computed factors. */
export async function decisionPhrasing(opts: {
  decisionText: string;
  language: 'en' | 'hi';
  verdict: 'favorable' | 'mixed' | 'wait';
  score: number;
  factors: string[];
  windows: string[];
  dashaContext: string;
}): Promise<string> {
  const langRule = opts.language === 'hi'
    ? 'Respond in warm natural Hindi (Devanagari).'
    : 'Respond in English.';
  const system = `You are ${ACHARYA_NAME}. A user is weighing a decision and the app has computed an astrological timing analysis. Phrase a SHORT plain verdict (90-150 words): open with the verdict (favorable / mixed with caution / wait), reference 2-3 of the computed factors in plain language, mention the suggested window if given, close with one grounding line. Never invent astrological facts beyond the factors given. ${langRule}`;
  const user = `DECISION: ${opts.decisionText}
VERDICT: ${opts.verdict} (score ${opts.score}/100)
FACTORS: ${opts.factors.join(' | ')}
SUGGESTED WINDOWS: ${opts.windows.join(' | ') || 'none within 14 days'}
CURRENT DASHA: ${opts.dashaContext}`;
  const llm = await complete([{ role: 'user', content: user }], system);
  if (llm) return llm;
  const lead = opts.verdict === 'favorable' ? 'The timing supports moving forward.' : opts.verdict === 'mixed' ? 'Proceed, but with measured steps.' : 'Let this one breathe a little longer.';
  return `${lead} ${opts.factors.slice(0, 2).join('. ')}. ${opts.windows[0] ? `A cleaner window opens around ${opts.windows[0]}.` : 'No cleaner window appears within two weeks — steady effort now is fine.'}`;
}

/** Pattern-dashboard correlation narrative — computed from REAL aggregates. */
export async function patternNarrative(opts: {
  language: 'en' | 'hi';
  aggregates: {
    days: number;
    avgMood: number;
    bestPeriod: { label: string; avgMood: number } | null;
    worstPeriod: { label: string; avgMood: number } | null;
    moodEnergyCorrelation: number | null;
    weekendEffect: number | null;
    notableNotes: string[];
  };
}): Promise<string | null> {
  const langRule = opts.language === 'hi'
    ? 'Respond in warm natural Hindi (Devanagari).'
    : 'Respond in English.';
  const system = `You are ${ACHARYA_NAME}. Write a 3-5 sentence pattern insight for the Karma Journal dashboard, using ONLY the aggregate statistics provided (they are computed from the user's real check-ins — do not invent numbers). Tone: warm, precise, empowering. ${langRule}`;
  return complete([{ role: 'user', content: JSON.stringify(opts.aggregates) }], system);
}

/**
 * One-line Acharya micro-note for a single daily check-in.
 * Interprets the logged mood/energy through the dasha period recorded that day.
 * Strictly grounded in the provided data; 1-2 sentences max.
 */
export async function checkinMicroNote(opts: {
  language: 'en' | 'hi';
  date: string;
  mood: number;
  energy: number | null;
  note: string | null;
  mahaLord: string;
  antarLord?: string;
  moonSign?: string;
}): Promise<string | null> {
  const langRule = opts.language === 'hi'
    ? 'Respond in warm natural Hindi (Devanagari).'
    : 'Respond in English.';
  const system = `You are ${ACHARYA_NAME}. Write a ONE to TWO sentence micro-reflection connecting the user's logged day to its astrological weather. Use ONLY the data provided — never invent placements. Tone: warm, specific, gently empowering; optionally one tiny practical nudge. No greetings, no sign-off, no bullet points. ${langRule}`;
  const user = `DATE: ${opts.date}
MAHA DASHA LORD: ${opts.mahaLord}
ANTARDASHA LORD: ${opts.antarLord ?? 'unknown'}
MOON SIGN THAT DAY: ${opts.moonSign ?? 'unknown'}
MOOD: ${opts.mood}/5
ENERGY: ${opts.energy != null ? `${opts.energy}/5` : 'not logged'}
USER NOTE: ${opts.note?.trim() || 'none'}`;
  const llm = await complete([{ role: 'user', content: user }], system);
  if (llm) return llm;
  // Deterministic fallback
  const lord = opts.mahaLord;
  return opts.language === 'hi'
    ? `${lord} की दशा में आपकी मन:शक्ति धीरे-धीरे लौट रही है — आज एक छोटा, स्थिर कदम पर्याप्त है।`
    : `Under ${lord}'s dasha your inner weather is slowly settling — one small, steady step today is enough.`;
}

/**
 * Festival / parva significance (vrat katha in brief) — classical, warm,
 * 70-120 words. Not user-specific: the same text is cached per festival.
 */
export async function festivalSignificance(opts: {
  name: string;
  kind: 'festival' | 'ekadashi' | 'sankranti';
  language: 'en' | 'hi';
  anchor?: string;
}): Promise<string> {
  const langRule =
    opts.language === 'hi'
      ? 'उत्तर स्वाभाविक, गर्म हिंदी (देवनागरी) में दें।'
      : 'Respond in natural, warm English.';
  const kindRule =
    opts.kind === 'ekadashi'
      ? 'This is one of the 24 named EKADASHI vrats. Briefly say which tradition it belongs to and its classical benefit.'
      : opts.kind === 'sankranti'
        ? 'This is a SANKRANTI (solar ingress). Briefly explain what the Sun entering this sign classically marks (Uttarayan/Dakshinayan context where apt) and common observances.'
        : 'This is a major Hindu festival/parva. Give its classical significance and a 1-2 line essence of the associated story/vrat katha.';
  const anchorRule = opts.anchor
    ? ` CLASSICAL TIMING (verified — never contradict): the observance falls on ${opts.anchor} (purnimanta lunar month scheme).`
    : '';
  const system = `You are ${ACHARYA_NAME}, a wise Vedic astrologer. Explain the significance of a Hindu observance in 70-120 words: what it commemorates (classical story in essence), why it matters spiritually, and one simple way an ordinary devotee can observe it. Never invent dates or rituals beyond common tradition. No greetings, no markdown headings, flowing prose. ${kindRule}${anchorRule} ${langRule}`;
  const llm = await complete([{ role: 'user', content: `OBSERVANCE: ${opts.name}` }], system);
  if (llm) return llm;
  return opts.language === 'hi'
    ? `${opts.name} का पालन भक्ति, संयम और कृतज्ञता का पर्व है। इस दिन संकल्प लेकर, दीप जलाकर और मन को एकाग्र कर अपने कर्मों को समर्पण भाव से करने का विधान है — यही इसका सार है।`
    : `${opts.name} is observed with devotion, restraint and gratitude. Traditionally one takes a resolve, lights a lamp, and turns the mind inward — offering the day's actions with surrender. That essence is its real significance.`;
}
