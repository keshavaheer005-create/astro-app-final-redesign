import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/session';
import { computeChart } from '@/lib/astro/chart';
import { dashaSnapshot } from '@/lib/astro/dasha';

export const runtime = 'nodejs';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekStartStr(d = new Date()): string {
  const day = d.getDay(); // 0 Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

async function snapshotForUser(userId: string) {
  // primary chart → dasha snapshot for today
  const chart = await db.birthChart.findFirst({ where: { userId, isPrimary: true } });
  if (!chart) return null;
  const c = computeChart({
    name: chart.name,
    dob: chart.dob,
    tob: chart.tob,
    lat: chart.lat,
    lng: chart.lng,
    timezone: chart.timezone,
  });
  const moon = c.planets.find((p) => p.key === 'Mo')!;
  return { snapshot: dashaSnapshot(c.dashas), moonSign: c.moonSign, moonLon: moon.lon, dashas: c.dashas };
}

/** GET /api/checkins — entries + streak + insights + this week's reflection status */
export async function GET() {
  try {
    const user = await ensureUser();
    const entries = await db.dailyCheckIn.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 120,
    });

    // streak
    const dates = new Set(entries.map((e) => e.date));
    let streak = 0;
    const cursor = new Date();
    if (!dates.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
    while (dates.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const weekStart = weekStartStr();
    const weekEntries = entries.filter((e) => e.date >= weekStart);
    const reflection = await db.weeklyReflection.findUnique({
      where: { userId_weekStartDate: { userId: user.id, weekStartDate: weekStart } },
    });

    return NextResponse.json({
      streak,
      checkedInToday: dates.has(todayStr()),
      total: entries.length,
      entries: entries.map((e) => ({
        id: e.id,
        date: e.date,
        moodScore: e.moodScore,
        energyScore: e.energyScore,
        note: e.note,
        dashaPeriodSnapshot: e.dashaPeriodSnapshot ? JSON.parse(e.dashaPeriodSnapshot) : null,
      })),
      weekEntryCount: weekEntries.length,
      reflection: reflection
        ? { weekStartDate: reflection.weekStartDate, reflectionText: reflection.reflectionText }
        : null,
    });
  } catch (e) {
    console.error('[checkins GET]', e);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}

/** POST /api/checkins — { moodScore, energyScore?, note? } upsert for today */
export async function POST(req: Request) {
  try {
    const user = await ensureUser();
    const { moodScore, energyScore, note } = await req.json();
    const mood = Number(moodScore);
    if (!Number.isInteger(mood) || mood < 1 || mood > 5) {
      return NextResponse.json({ error: 'invalid_mood' }, { status: 400 });
    }
    const energy = energyScore == null ? null : Math.max(1, Math.min(5, Number(energyScore)));
    const date = todayStr();

    const snap = await snapshotForUser(user.id);
    const snapshot = snap?.snapshot
      ? JSON.stringify({ ...snap.snapshot, moonSign: snap.moonSign.name })
      : JSON.stringify(null);

    const entry = await db.dailyCheckIn.upsert({
      where: { userId_date: { userId: user.id, date } },
      create: {
        userId: user.id,
        date,
        moodScore: mood,
        energyScore: energy,
        note: note ? String(note).slice(0, 800) : null,
        dashaPeriodSnapshot: snapshot,
      },
      update: {
        moodScore: mood,
        energyScore: energy,
        note: note ? String(note).slice(0, 800) : null,
        dashaPeriodSnapshot: snapshot,
      },
    });

    // recompute streak quickly
    const all = await db.dailyCheckIn.findMany({ where: { userId: user.id }, orderBy: { date: 'desc' }, select: { date: true } });
    const dates = new Set(all.map((e) => e.date));
    let streak = 0;
    const cursor = new Date();
    while (dates.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return NextResponse.json({ entry: { id: entry.id, date: entry.date }, streak });
  } catch (e) {
    console.error('[checkins POST]', e);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}

/** PATCH /api/checkins — pattern dashboard aggregates (mood × dasha correlation) */
export async function PATCH() {
  try {
    const user = await ensureUser();
    const entries = await db.dailyCheckIn.findMany({
      where: { userId: user.id },
      orderBy: { date: 'asc' },
    });
    if (entries.length === 0) {
      return NextResponse.json({ ready: false, days: 0 });
    }

    // group by dasha period snapshot (maha lord)
    const groups = new Map<string, { sum: number; n: number; energySum: number; energyN: number }>();
    let moodSum = 0;
    let energySum = 0;
    let energyN = 0;
    let weekendSum = 0;
    let weekendN = 0;
    let weekdaySum = 0;
    let weekdayN = 0;

    for (const e of entries) {
      let snap: { mahaLord?: string } | null = null;
      try {
        snap = e.dashaPeriodSnapshot ? JSON.parse(e.dashaPeriodSnapshot) : null;
      } catch {
        snap = null;
      }
      const label = snap?.mahaLord ?? 'Unknown';
      const g = groups.get(label) ?? { sum: 0, n: 0, energySum: 0, energyN: 0 };
      g.sum += e.moodScore;
      g.n += 1;
      if (e.energyScore != null) {
        g.energySum += e.energyScore;
        g.energyN += 1;
      }
      groups.set(label, g);

      moodSum += e.moodScore;
      if (e.energyScore != null) {
        energySum += e.energyScore;
        energyN += 1;
      }
      const dow = new Date(`${e.date}T12:00:00Z`).getUTCDay();
      if (dow === 0 || dow === 6) {
        weekendSum += e.moodScore;
        weekendN += 1;
      } else {
        weekdaySum += e.moodScore;
        weekdayN += 1;
      }
    }

    const periods = [...groups.entries()]
      .filter(([, g]) => g.n >= 2)
      .map(([label, g]) => ({ label, avgMood: Math.round((g.sum / g.n) * 10) / 10, days: g.n }))
      .sort((a, b) => b.avgMood - a.avgMood);

    // mood-energy correlation (Pearson)
    let correlation: number | null = null;
    const pairs = entries.filter((e) => e.energyScore != null);
    if (pairs.length >= 5) {
      const xs = pairs.map((e) => e.moodScore);
      const ys = pairs.map((e) => e.energyScore as number);
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = ys.reduce((a, b) => a + b, 0) / ys.length;
      const num = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0);
      const den = Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0)) * Math.sqrt(ys.reduce((a, y) => a + (y - my) ** 2, 0));
      correlation = den > 0 ? Math.round((num / den) * 100) / 100 : null;
    }

    const days = entries.length;
    const avgMood = Math.round((moodSum / days) * 10) / 10;
    const weekendEffect = weekendN >= 2 && weekdayN >= 2
      ? Math.round(((weekendSum / weekendN - weekdaySum / weekdayN)) * 10) / 10
      : null;

    return NextResponse.json({
      ready: days >= 14,
      days,
      avgMood,
      avgEnergy: energyN ? Math.round((energySum / energyN) * 10) / 10 : null,
      bestPeriod: periods[0] ?? null,
      worstPeriod: periods.length >= 2 ? periods[periods.length - 1] : null,
      periods,
      correlation,
      weekendEffect,
      notableNotes: entries.filter((e) => e.note).slice(-6).map((e) => ({ date: e.date, note: e.note })),
    });
  } catch (e) {
    console.error('[checkins PATCH insights]', e);
    return NextResponse.json({ error: 'insights_failed' }, { status: 500 });
  }
}
