/**
 * Seed a member user + chart + chat history for local UI audit.
 * Reuses the guest's computed chartData blob; creates older conversations.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const MEMBER_ID = 'member-audit-01';

async function main() {
  const guestChart = await db.birthChart.findFirst({
    orderBy: { createdAt: 'asc' },
    include: { user: true },
  });
  if (!guestChart) throw new Error('no chart found — complete onboarding first');
  console.log('guest user:', guestChart.userId, 'chart:', guestChart.id);

  let member = await db.user.findUnique({ where: { id: MEMBER_ID } });
  if (!member) {
    member = await db.user.create({
      data: {
        id: MEMBER_ID,
        email: 'audit@local.test',
        name: 'Arjun',
        isGuest: false,
      },
    });
    console.log('member created');
  }

  // Clone the guest's chart for the member (one active chart)
  let chart = await db.birthChart.findFirst({ where: { userId: MEMBER_ID } });
  if (!chart) {
    chart = await db.birthChart.create({
      data: {
        userId: MEMBER_ID,
        name: guestChart.name,
        dob: guestChart.dob,
        tob: guestChart.tob,
        lat: guestChart.lat,
        lng: guestChart.lng,
        timezone: guestChart.timezone,
        placeName: guestChart.placeName,
        chartData: guestChart.chartData,
        isPrimary: true,
      },
    });
    console.log('member chart cloned:', chart.id);
  }

  const cid = chart.id;
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const existing = await db.chatMessage.count({ where: { userId: MEMBER_ID } });
  if (existing > 0) {
    console.log('chat messages already seeded:', existing);
    return;
  }

  const convo = (conversationId: string, title: string, ageDays: number, pairs: [string, string][]) => {
    const base = now - ageDays * day;
    const meta = JSON.stringify({ conversationId, title });
    const rows: { userId: string; chartId: string; meta: string; role: string; content: string; createdAt: Date }[] = [];
    pairs.forEach(([u, a], i) => {
      rows.push({ userId: MEMBER_ID, chartId: cid, meta, role: 'user', content: u, createdAt: new Date(base + i * 2 * 60000) });
      rows.push({ userId: MEMBER_ID, chartId: cid, meta, role: 'assistant', content: a, createdAt: new Date(base + i * 2 * 60000 + 30000) });
    });
    return rows;
  };

  await db.chatMessage.createMany({
    data: [
      ...convo('conv-audit-old-01', 'Career & job switch', 21, [
        ['Will this year be good for my career?', 'Your chart shows Venus mahadasha beginning February 2026 — a period that favors creative growth and recognition. With Venus ruling your 1st house, this year supports personal reinvention.'],
        ['What about switching jobs mid-year?', 'The October transits bring Saturn pressure on your 10th house — wait until early November before making the leap.'],
      ]),
      ...convo('conv-audit-old-02', 'Low energy week', 9, [
        ['Why have I felt low this week?', 'Saturn is transiting your 5th house this week while the Moon passes through Scorpio — emotional heaviness around self-expression is common under this pattern. It lifts in about four days.'],
      ]),
      ...convo('conv-audit-yest-01', 'Interview timing', 1, [
        ['Is today good for an interview?', 'Today carries Shukla Navami with Shravana nakshatra — favorable for conversations where you must be heard. The afternoon Abhijit muhurta (11:48–12:36) is the strongest window.'],
        ['Any tips for the conversation?', 'Lead with facts, not promises — Mercury in your 1st house rewards precision today.'],
      ]),
      ...convo('conv-audit-today-1', 'Focus for this month', 0, [
        ['What should I focus on this month?', 'This month is about steady accumulation — Venus antardasha rewards daily rituals over big gestures. Your journal shows energy dips on Thursdays; schedule demanding work early.'],
      ]),
    ],
  });
  const n = await db.chatMessage.count({ where: { userId: MEMBER_ID } });
  console.log('seeded chat messages:', n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
