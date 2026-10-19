import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser, memberGuard } from '@/lib/session';
import { checkinMicroNote } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/checkins/micro-note — body { id, language }
 * Generates (and caches on the DailyCheckIn row) a one-two sentence Acharya
 * reflection connecting that day's logged mood to its dasha weather.
 * → { microNote, cached }
 */
export async function POST(req: Request) {
  try {
    const blocked = await memberGuard('ai');
    if (blocked) return blocked;
    const user = await ensureUser();
    const { id, language } = (await req.json()) as { id?: string; language?: string };
    if (!id) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }

    const entry = await db.dailyCheckIn.findFirst({ where: { id, userId: user.id } });
    if (!entry) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (entry.microNote) {
      return NextResponse.json({ microNote: entry.microNote, cached: true });
    }

    let snap: { mahaLord?: string; antarLord?: string; moonSign?: string } = {};
    try {
      snap = JSON.parse(entry.dashaPeriodSnapshot) as typeof snap;
    } catch {
      /* malformed snapshot — proceed with empty */
    }
    const mahaLord = snap.mahaLord ?? 'the current';
    if (!snap.mahaLord) {
      return NextResponse.json({ error: 'no_dasha_snapshot' }, { status: 409 });
    }

    const microNote = await checkinMicroNote({
      language: language === 'hi' ? 'hi' : 'en',
      date: entry.date,
      mood: entry.moodScore,
      energy: entry.energyScore,
      note: entry.note,
      mahaLord,
      antarLord: snap.antarLord,
      moonSign: snap.moonSign,
    });

    if (!microNote) {
      return NextResponse.json({ error: 'generation_failed' }, { status: 502 });
    }

    await db.dailyCheckIn.update({ where: { id: entry.id }, data: { microNote } });
    return NextResponse.json({ microNote, cached: false });
  } catch (e) {
    console.error('[checkins/micro-note]', e);
    return NextResponse.json({ error: 'micro_note_failed' }, { status: 500 });
  }
}
