import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUserId } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * POST /api/account/clear — body { confirm: 'CLEAR_ALL' }
 *
 * Deletes ALL of the signed-in user's data: every saved chart, journal
 * check-in, Acharya chat, weekly letter, decision check and reminder setting.
 * The login itself (Google / email) is kept, so the user lands on the
 * "create your profile" screen and can start fresh.
 */
export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== 'CLEAR_ALL') {
      return NextResponse.json({ error: 'confirm_required' }, { status: 400 });
    }

    // Children first (also covers rows that were never tied to a chart), then charts.
    const [chat, checkIns, letters, decisions, , charts] = await db.$transaction([
      db.chatMessage.deleteMany({ where: { userId } }),
      db.dailyCheckIn.deleteMany({ where: { userId } }),
      db.weeklyReflection.deleteMany({ where: { userId } }),
      db.decisionCheck.deleteMany({ where: { userId } }),
      db.reminderSettings.deleteMany({ where: { userId } }),
      db.birthChart.deleteMany({ where: { userId } }),
    ]);

    return NextResponse.json({
      ok: true,
      deleted: {
        charts: charts.count,
        checkIns: checkIns.count,
        chat: chat.count,
        letters: letters.count,
        decisions: decisions.count,
      },
    });
  } catch (e) {
    console.error('[account/clear]', e);
    return NextResponse.json({ error: 'clear_failed' }, { status: 500 });
  }
}
