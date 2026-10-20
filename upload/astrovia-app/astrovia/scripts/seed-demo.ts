/**
 * Seed a ready-to-use demo account for preview testing.
 *
 * Creates (idempotently):
 *   • user  demo@astrovia.app  /  astrovia123
 *   • primary birth chart (computed with the real engine)
 *   • TWO older conversations so the chat-history view can be tested
 *   • a few journal check-ins for Acharya context
 *
 * Usage (embedded dev Postgres must be running):
 *   DATABASE_URL=postgresql://vedastro:vedastro@localhost:5432/vedastro \
 *     bun scripts/seed-demo.ts
 */
import { scryptSync, randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { computeChart } from '../src/lib/astro/chart';

const EMAIL = 'demo@astrovia.app';
const PASSWORD = 'astrovia123';
const CONV_A = 'democonvsaturn01';
const CONV_B = 'democonvmoon0202';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

const db = new PrismaClient();

const daysAgo = (n: number, h = 10, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d;
};

async function main() {
  const passwordHash = hashPassword(PASSWORD);
  const user = await db.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, isGuest: false },
    create: { email: EMAIL, passwordHash, name: 'Aarav Sharma', isGuest: false },
  });

  const existingChart = await db.birthChart.findFirst({ where: { userId: user.id, isPrimary: true } });
  const chartInput = {
    name: 'Aarav Sharma',
    dob: '1995-08-20',
    tob: '09:15',
    lat: 28.6139,
    lng: 77.209,
    timezone: 'Asia/Kolkata',
    placeName: 'New Delhi, India',
  };
  const chartData = JSON.stringify(computeChart(chartInput));
  const chart = existingChart
    ? await db.birthChart.update({ where: { id: existingChart.id }, data: { ...chartInput, chartData, isPrimary: true } })
    : await db.birthChart.create({ data: { userId: user.id, isPrimary: true, ...chartInput, chartData } });

  const meta = (conversationId: string, title: string) => JSON.stringify({ conversationId, title });

  type Turn = { role: 'user' | 'assistant'; content: string; day: number; hour: number; minute: number };
  const convA: Turn[] = [
    { role: 'user', content: 'Acharya ji, Saturn is transiting my 10th house. Is this a bad time to ask for a promotion at work?', day: 3, hour: 9, minute: 12 },
    { role: 'assistant', content: 'Saturn\u2019s transit through your 10th house is not a punishment — it is an audit. With your Capricorn lagna lord Saturn examining your karma-sthana, effort made now is weighed with unusual precision.\n\n**What helps now**\n- Ask for the promotion, but arrive with documented results from the past 12 months.\n- Avoid pressing your case during the waning Moon this month.\n- Saturday fasts or a simple sesame-oil lamp on Saturdays steady the mind for such conversations.\n\nYour dasha lord supports recognition through patience, not pressure. Present your work calmly — the delay you fear is mostly in the mind, not in the planets.', day: 3, hour: 9, minute: 14 },
    { role: 'user', content: 'That helps. And what about switching teams inside the same company — also postponed?', day: 3, hour: 9, minute: 20 },
    { role: 'assistant', content: 'An internal move is viewed more kindly than an external jump in this transit. The 10th house rewards *continuity with refinement* — same tree, better branch.\n\nIf the new team lets you use your Mercury strength (analysis, communication), the switch is supportive. Choose a Wednesday to send the request; keep the tone factual, not emotional.\n\nOne small practice this week: before you write the request, write down three outcomes you want in 6 months. Clarity now prevents doubt later.', day: 3, hour: 9, minute: 22 },
    { role: 'user', content: 'Thank you. Any remedy for the anxiety I feel before these talks?', day: 2, hour: 18, minute: 40 },
    { role: 'assistant', content: 'For Saturn-related anxiety, steadiness beats intensity. For the next two weeks:\n\n1. **Morning** — 5 slow breaths before opening your laptop; Saturn respects rhythm.\n2. **Evening** — 10 minutes of quiet sitting after sunset, no phone.\n3. **Saturday** — help someone who cannot repay you; that is Saturn\u2019s favourite remedy.\n\nThe anxiety you feel is Saturn asking for preparation, not permission. Prepare, and it softens.', day: 2, hour: 18, minute: 43 },
  ];

  const convB: Turn[] = [
    { role: 'user', content: 'I keep waking up at 3am during this Moon dasha. Is that a sign of anything?', day: 5, hour: 7, minute: 5 },
    { role: 'assistant', content: 'Waking in the small hours during Moon dasha is common — the Moon rules the mind\u2019s tides, and at 3am the mind is at its lightest.\n\nLook at it as a gentle signal, not an omen. Your chart shows a sensitive Moon in the 4th; unprocessed feelings surface when the world is quiet.\n\n**Tonight, try this:** a cup of warm milk with a pinch of nutmeg, and write down the one thought that woke you. Naming it returns the tide to its bank.', day: 5, hour: 7, minute: 8 },
    { role: 'user', content: 'Okay, will try. Does the full moon this week make it worse?', day: 5, hour: 7, minute: 30 },
    { role: 'assistant', content: 'Yes — for a Moon-ruled mind, the three days around the full Moon amplify everything: sleep dips, emotions run closer to the skin. This is temporary and predictable.\n\nPlan lighter evenings around the full Moon: no difficult conversations, no late screens. A moon-lit walk or listening to soft music settles the mind better than forcing sleep.\n\nRemember: the Moon waxes and wanes, and so will your nights. Ride the tide, don\u2019t fight it.', day: 5, hour: 7, minute: 33 },
  ];

  for (const [convId, title, turns] of [
    [CONV_A, 'Saturn transit and career doubt', convA],
    [CONV_B, 'Moon dasha and early-morning waking', convB],
  ] as const) {
    const has = await db.chatMessage.findFirst({ where: { userId: user.id, chartId: chart.id, meta: { contains: `"conversationId":"${convId}"` } } });
    if (has) continue;
    await db.chatMessage.createMany({
      data: turns.map((t) => ({
        userId: user.id,
        chartId: chart.id,
        role: t.role,
        content: t.content,
        meta: meta(convId, title),
        createdAt: daysAgo(t.day, t.hour, t.minute),
      })),
    });
  }

  const checkins = [
    { date: daysAgo(3).toISOString().slice(0, 10), moodScore: 3, energyScore: 3, note: 'Work talk pending, felt restless in the morning.' },
    { date: daysAgo(2).toISOString().slice(0, 10), moodScore: 4, energyScore: 4, note: 'Went for a walk after sunset, mind was calmer.' },
    { date: daysAgo(1).toISOString().slice(0, 10), moodScore: 4, energyScore: 3, note: 'Slept better, woke only once at night.' },
  ];
  for (const c of checkins) {
    const existing = await db.dailyCheckIn.findFirst({ where: { chartId: chart.id, date: c.date } });
    if (!existing) await db.dailyCheckIn.create({ data: { userId: user.id, chartId: chart.id, ...c } });
  }

  console.log(`seeded: ${user.email} (user ${user.id}), chart ${chart.id}, 2 old conversations, ${checkins.length} check-ins`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
