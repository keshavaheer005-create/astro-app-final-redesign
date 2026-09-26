import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/session';
import { computeChart, compactChartContext, ComputedChart } from '@/lib/astro/chart';
import { acharyaReply } from '@/lib/ai';
import { moonNakshatraNow } from '@/lib/astro/horoscope';
import { sadeSati } from '@/lib/astro/doshas';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST /api/ask-acharya — body { question, language? } (chart pulled from saved primary chart) */
export async function POST(req: Request) {
  try {
    const user = await ensureUser();
    const { question, language } = await req.json();
    const q = String(question ?? '').trim();
    if (!q) return NextResponse.json({ error: 'empty_question' }, { status: 400 });
    const lang = language === 'hi' ? 'hi' : 'en';

    const saved = await db.birthChart.findFirst({ where: { userId: user.id, isPrimary: true } });
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
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 14,
    });
    const reflections = await db.weeklyReflection.findMany({
      where: { userId: user.id },
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
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    const turns = history
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const answer = await acharyaReply({
      question: q,
      chartContext,
      journalContext,
      history: turns,
      language: lang,
    });

    await db.chatMessage.create({ data: { userId: user.id, role: 'user', content: q } });
    await db.chatMessage.create({ data: { userId: user.id, role: 'assistant', content: answer } });

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
    const msgs = await db.chatMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      take: 60,
    });
    return NextResponse.json({
      messages: msgs.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })),
    });
  } catch (e) {
    console.error('[ask-acharya GET]', e);
    return NextResponse.json({ messages: [] });
  }
}
