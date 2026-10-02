import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const chart = await db.birthChart.findFirst({ where: { name: 'Arjun', isPrimary: true } });
  if (!chart) { console.log('no chart'); return; }
  const uid = chart.userId;
  const existing = await db.dailyCheckIn.count({ where: { userId: uid } });
  if (existing >= 3) { console.log('already seeded:', existing); return; }
  const snap = JSON.stringify({ mahaLord: 'Ve', antarLord: 'Ju', mahaStart: '2014-04', mahaEnd: '2034-03' });
  const mk = (d: string, mood: number, energy: number, note: string) => ({ userId: uid, date: d, moodScore: mood, energyScore: energy, note, dashaPeriodSnapshot: snap });
  await db.dailyCheckIn.createMany({ data: [
    mk('2026-09-24', 2, 2, 'Heavy morning, too many meetings drained me'),
    mk('2026-09-25', 3, 4, 'Gym before work helped a lot'),
  ] });
  console.log('entries now:', await db.dailyCheckIn.count({ where: { userId: uid } }));
}
main().finally(() => db.$disconnect());
