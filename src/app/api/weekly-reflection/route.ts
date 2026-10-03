import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/session';
import { getActiveChart } from '@/lib/active-chart';
import { memberGuard } from '@/lib/session';
import { computeChart } from '@/lib/astro/chart';
import { weeklyReflection } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

function weekStartStr(d = new Date()): string {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

/**
 * GET /api/weekly-reflection
 * Auto-generates this week's letter when ≥3 check-ins exist and none is stored
 * yet (lazy scheduled job — runs once per week per user, on first load).
 */
const VALID_LANGS = new Set(['en', 'hi']);

export async function GET(req: Request) {
  try {
    if (await memberGuard('ai')) return NextResponse.json({ reflection: null, reason: 'signin_required' });
    const user = await ensureUser();
    const url = new URL(req.url);
    const langParam = url.searchParams.get('lang');
    const language: 'en' | 'hi' = langParam && VALID_LANGS.has(langParam) ? (langParam as 'en' | 'hi') : 'en';
    const weekStart = weekStartStr();
    const saved = await getActiveChart(user.id);
    if (!saved) return NextResponse.json({ reflection: null, reason: 'no_chart' });
    const existing = await db.weeklyReflection.findUnique({
      where: { chartId_weekStartDate_language: { chartId: saved.id, weekStartDate: weekStart, language } },
    });
    if (existing) {
      return NextResponse.json({
        reflection: { weekStartDate: existing.weekStartDate, reflectionText: existing.reflectionText },
        generated: false,
      });
    }

    // Need a chart + at least 3 check-ins this week to write a letter
    const weekEntries = await db.dailyCheckIn.findMany({
      where: { chartId: saved.id, date: { gte: weekStart } },
      orderBy: { date: 'asc' },
    });
    if (weekEntries.length < 3) {
      return NextResponse.json({ reflection: null, reason: 'not_enough_checkins' });
    }

    const chart = computeChart({
      name: saved.name,
      dob: saved.dob,
      tob: saved.tob,
      lat: saved.lat,
      lng: saved.lng,
      timezone: saved.timezone,
    });
    const ds = chart.dashaSnapshot;
    const dashaContext = ds
      ? `Currently in ${ds.mahaLord} mahadasha (until ${ds.mahaEnd})${ds.antarLord ? `, ${ds.antarLord} antardasha (until ${ds.antarEnd})` : ''}. Moon sign ${chart.moonSign.name}.`
      : 'Dasha context unavailable.';

    const text = await weeklyReflection({
      name: saved.name,
      language,
      dashaContext,
      checkins: weekEntries.map((c) => ({
        date: c.date,
        mood: c.moodScore,
        energy: c.energyScore,
        note: c.note,
      })),
    });
    if (!text) {
      return NextResponse.json({ reflection: null, reason: 'generation_failed' });
    }

    const created = await db.weeklyReflection.create({
      data: { userId: user.id, chartId: saved.id, weekStartDate: weekStart, language, reflectionText: text },
    });
    return NextResponse.json({
      reflection: { weekStartDate: created.weekStartDate, reflectionText: created.reflectionText },
      generated: true,
    });
  } catch (e) {
    console.error('[weekly-reflection]', e);
    return NextResponse.json({ reflection: null, reason: 'error' }, { status: 500 });
  }
}

/** GET history of past letters */
export async function POST() {
  try {
    const user = await ensureUser();
    const active = await getActiveChart(user.id);
    if (!active) return NextResponse.json({ reflections: [] });
    const list = await db.weeklyReflection.findMany({
      where: { chartId: active.id },
      orderBy: { weekStartDate: 'desc' },
      take: 12,
    });
    return NextResponse.json({
      reflections: list.map((r) => ({ weekStartDate: r.weekStartDate, reflectionText: r.reflectionText })),
    });
  } catch (e) {
    console.error('[weekly-reflection POST]', e);
    return NextResponse.json({ reflections: [] });
  }
}
