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
export async function acharyaReply(opts: {
  question: string;
  chartContext: string;
  journalContext: string;
  history: ChatTurn[];
  language: 'en' | 'hi';
}): Promise<string> {
  const langRule =
    opts.language === 'hi'
      ? 'Respond in natural, warm Hindi (Devanagari script). Use everyday Hindi with light Sanskrit terms where natural.'
      : 'Respond in English (you may use Sanskrit terms with a short gloss).';
  const system = `${PERSONA}

You are answering inside the "Self Sage" app. Ground every answer in the USER DATA below — cite specific placements, dasha periods or journal entries. If the data does not support a claim, say what the chart actually shows instead of inventing details. Never produce a generic horoscope. Keep answers 120-220 words. ${langRule}

USER DATA (verified Swiss Ephemeris computations, Lahiri ayanamsa):
${opts.chartContext}

KARMA JOURNAL (recent daily check-ins, most recent first):
${opts.journalContext || 'No journal entries yet.'}`;

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
