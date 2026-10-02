import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/session';
import { getActiveChart } from '@/lib/active-chart';
import { computeChart, compactChartContext, ComputedChart } from '@/lib/astro/chart';
import { acharyaReply, acharyaStreamReply, type ChatTurn } from '@/lib/ai';
import { moonNakshatraNow } from '@/lib/astro/horoscope';
import { sadeSati } from '@/lib/astro/doshas';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST /api/ask-acharya — body { question, language?, stream? } (chart pulled from saved primary chart) */
export async function POST(req: Request) {
  try {
    const user = await ensureUser();
    const { question, language, stream, journalRef } = await req.json();
    const q = String(question ?? '').trim();
    if (!q) return NextResponse.json({ error: 'empty_question' }, { status: 400 });
    const lang = language === 'hi' ? 'hi' : 'en';
    // Optional journal threading: a "YYYY-MM-DD" the exchange refers to
    // ("discuss this note"). Persisted on both turns so the jump-back pill
    // survives reloads.
    const metaJson =
      typeof journalRef === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(journalRef)
        ? JSON.stringify({ journalRef })
        : null;

    const saved = await getActiveChart(user.id);
    if (!saved) {
      return NextResponse.json({ error: 'no_chart' }, { status: 400 });
    }
    const chart: ComputedChart = computeChart({
      name: saved.name,
      dob: saved.dob,
      tob: saved.tob,
      lat: saved.lat,
      lng: saved.lng,
      timezone: saved.timezone,
      placeName: saved.placeName ?? undefined,
    });

    // Journal context: last 14 check-ins + any saved reflections
    const checkins = await db.dailyCheckIn.findMany({
      where: { chartId: saved.id },
      orderBy: { date: 'desc' },
      take: 14,
    });
    const reflections = await db.weeklyReflection.findMany({
      where: { chartId: saved.id },
      orderBy: { weekStartDate: 'desc' },
      take: 1,
    });

    const moon = chart.planets.find((p) => p.key === 'Mo')!;
    const ss = sadeSati(moon.lon, new Date());
    const nak = moonNakshatraNow(new Date());
    const journalContext = [
      ...checkins.map((c) => {
        let snap: { mahaLord?: string; antarLord?: string } = {};
        try { snap = c.dashaPeriodSnapshot ? JSON.parse(c.dashaPeriodSnapshot) : {}; } catch { /* */ }
        return `${c.date}: mood ${c.moodScore}/5${c.energyScore ? `, energy ${c.energyScore}/5` : ''}${snap.mahaLord ? ` (during ${snap.mahaLord} mahadasha${snap.antarLord ? `, ${snap.antarLord} antardasha` : ''})` : ''}${c.note ? ` — note: "${c.note}"` : ''}`;
      }),
      reflections[0] ? `Latest weekly reflection (week of ${reflections[0].weekStartDate}): "${reflections[0].reflectionText.slice(0, 220)}…"` : '',
    ].filter(Boolean).join('\n');

    const chartContext = `${compactChartContext(chart)}
Transit context: natal Moon in ${chart.moonSign.name}; current Moon nakshatra ${nak.name}; Sade Sati ${ss.active ? `ACTIVE (${ss.phase} phase)` : 'not active'}.`;

    const history = await db.chatMessage.findMany({
      where: { chartId: saved.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    const turns: ChatTurn[] = history
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Personal context that goes into every prompt: who is asking, and what "today" is for them.
    const tz = saved.timezone && /[A-Za-z]+\/[A-Za-z_]+/.test(saved.timezone) ? saved.timezone : 'Asia/Kolkata';
    let nowLine = new Date().toDateString();
    try {
      nowLine = new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: tz }).format(new Date()) + ` (${tz})`;
    } catch { /* keep default */ }
    const born = new Date(`${saved.dob}T00:00:00Z`);
    const age = Number.isNaN(born.getTime()) ? null : Math.floor((Date.now() - born.getTime()) / 31_557_600_000);
    const profileContext = [
      `Name: ${saved.name}`,
      age != null ? `age ${age}` : '',
      `born ${saved.dob} at ${saved.tob}`,
      saved.placeName ? `born in ${saved.placeName}` : '',
      `Lagna ${chart.ascendant.signName}, Moon sign ${chart.moonSign.name}`,
      chart.dashaSnapshot ? `running ${chart.dashaSnapshot.mahaLord} mahadasha / ${chart.dashaSnapshot.antarLord ?? '—'} antardasha` : '',
      `prefers ${lang === 'hi' ? 'Hindi' : 'English'}`,
    ].filter(Boolean).join('; ');

    const grounding = {
      profileContext,
      nowLine,
      question: q,
      chartContext,
      journalContext,
      history: turns,
      language: lang as 'en' | 'hi',
    };

    if (stream) {
      // Persist the user turn now; the assistant turn is saved when the stream completes.
      await db.chatMessage.create({
        data: { userId: user.id, chartId: saved.id, role: 'user', content: q, ...(metaJson ? { meta: metaJson } : {}) },
      });
      const { stream: wire, done } = await acharyaStreamReply(grounding);
      void done
        .then((full) => {
          if (full && full.trim()) {
            return db.chatMessage.create({
              data: { userId: user.id, chartId: saved.id, role: 'assistant', content: full.trim(), ...(metaJson ? { meta: metaJson } : {}) },
            });
          }
        })
        .catch((e) => console.error('[ask-acharya] persist-after-stream:', (e as Error).message));
      return new Response(wire, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const answer = await acharyaReply(grounding);

    await db.chatMessage.create({
      data: { userId: user.id, chartId: saved.id, role: 'user', content: q, ...(metaJson ? { meta: metaJson } : {}) },
    });
    await db.chatMessage.create({
      data: { userId: user.id, chartId: saved.id, role: 'assistant', content: answer, ...(metaJson ? { meta: metaJson } : {}) },
    });

    return NextResponse.json({ answer });
  } catch (e) {
    console.error('[ask-acharya]', e);
    return NextResponse.json({ error: 'acharya_failed' }, { status: 500 });
  }
}

/** GET /api/ask-acharya — recent chat history */
export async function GET() {
  try {
    const user = await ensureUser();
    const active = await getActiveChart(user.id);
    if (!active) return NextResponse.json({ messages: [] });
    const msgs = await db.chatMessage.findMany({
      where: { chartId: active.id },
      orderBy: { createdAt: 'asc' },
      take: 60,
    });
    return NextResponse.json({
      messages: msgs.map((m) => {
        let journalRef: string | undefined;
        try {
          const meta = m.meta ? (JSON.parse(m.meta) as { journalRef?: string }) : null;
          if (meta?.journalRef && /^\d{4}-\d{2}-\d{2}$/.test(meta.journalRef)) journalRef = meta.journalRef;
        } catch {
          /* meta is optional */
        }
        return { id: m.id, role: m.role, content: m.content, createdAt: m.createdAt, journalRef };
      }),
    });
  } catch (e) {
    console.error('[ask-acharya GET]', e);
    return NextResponse.json({ messages: [] });
  }
}
