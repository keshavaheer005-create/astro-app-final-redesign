import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/session';

export const runtime = 'nodejs';

/** GET /api/reminders */
export async function GET() {
  try {
    const user = await ensureUser();
    let settings = await db.reminderSettings.findUnique({ where: { userId: user.id } });
    if (!settings) {
      settings = await db.reminderSettings.create({ data: { userId: user.id } });
    }
    return NextResponse.json({
      reminder: {
        checkinReminder: settings.checkinReminder,
        reminderTime: settings.reminderTime,
        weeklyReflection: settings.weeklyReflectionN,
      },
    });
  } catch (e) {
    console.error('[reminders GET]', e);
    return NextResponse.json({ reminder: { checkinReminder: true, reminderTime: '20:00', weeklyReflection: true } });
  }
}

/** PUT /api/reminders — { checkinReminder?, reminderTime?, weeklyReflection? } */
export async function PUT(req: Request) {
  try {
    const user = await ensureUser();
    const b = await req.json();
    const data: { checkinReminder?: boolean; reminderTime?: string; weeklyReflectionN?: boolean } = {};
    if (typeof b.checkinReminder === 'boolean') data.checkinReminder = b.checkinReminder;
    if (typeof b.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(b.reminderTime)) data.reminderTime = b.reminderTime;
    if (typeof b.weeklyReflection === 'boolean') data.weeklyReflectionN = b.weeklyReflection;
    const settings = await db.reminderSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
    return NextResponse.json({
      reminder: {
        checkinReminder: settings.checkinReminder,
        reminderTime: settings.reminderTime,
        weeklyReflection: settings.weeklyReflectionN,
      },
    });
  } catch (e) {
    console.error('[reminders PUT]', e);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}
