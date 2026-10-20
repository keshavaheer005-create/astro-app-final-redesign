import { db } from '@/lib/db';

/**
 * The user's ACTIVE birth chart (BirthChart.isPrimary). Every piece of
 * "general" data — journal check-ins, Acharya chat, weekly letters, decision
 * checks — is scoped to this chart, so each saved chart keeps its own data.
 *
 * Falls back to the oldest chart if none is flagged active (never returns a
 * chart that belongs to someone else).
 */
export async function getActiveChart(userId: string) {
  const active = await db.birthChart.findFirst({ where: { userId, isPrimary: true } });
  if (active) return active;
  return db.birthChart.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
}
