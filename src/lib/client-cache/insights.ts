/** Private, bounded saved AI insights. Scoped by confirmed account and chart. */
import { deleteByPrefix, deleteKey, readEnvelope, writeEnvelope } from './idb';

export interface SavedInsight {
  id: string;
  userId: string;
  chartId: string;
  title: string;
  content: string;
  createdAt: string;
  source?: string;
}

const MAX_SAVED_INSIGHTS = 80;
const keyOf = (userId: string, chartId: string) => `${userId}|${chartId}|saved-insights:v1`;

function cleanInsight(value: SavedInsight, userId: string, chartId: string): SavedInsight | null {
  if (!value || value.userId !== userId || value.chartId !== chartId) return null;
  if (typeof value.id !== 'string' || !value.id || typeof value.content !== 'string' || !value.content.trim()) return null;
  return {
    id: value.id.slice(0, 100),
    userId,
    chartId,
    title: String(value.title || 'Saved insight').replace(/\s+/g, ' ').slice(0, 120),
    content: value.content.slice(0, 16000),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    ...(value.source ? { source: String(value.source).slice(0, 100) } : {}),
  };
}

export async function readSavedInsights(userId: string, chartId: string): Promise<SavedInsight[]> {
  if (!userId || !chartId) return [];
  const envelope = await readEnvelope<{ userId: string; chartId: string; items: SavedInsight[] }>('meta', keyOf(userId, chartId));
  const value = envelope?.value;
  if (!value || value.userId !== userId || value.chartId !== chartId || !Array.isArray(value.items)) return [];
  return value.items.map((item) => cleanInsight(item, userId, chartId)).filter((x): x is SavedInsight => x !== null).slice(0, MAX_SAVED_INSIGHTS);
}

export async function saveInsight(input: Omit<SavedInsight, 'userId' | 'chartId' | 'createdAt'> & { userId: string; chartId: string; createdAt?: string }): Promise<SavedInsight | null> {
  if (!input.userId || !input.chartId || !input.content.trim()) return null;
  const item = cleanInsight({ ...input, createdAt: input.createdAt ?? new Date().toISOString() }, input.userId, input.chartId);
  if (!item) return null;
  const existing = await readSavedInsights(input.userId, input.chartId);
  const duplicate = existing.find((entry) => entry.content === item.content);
  const items = [duplicate ? { ...duplicate, title: item.title, source: item.source } : item, ...existing.filter((entry) => entry.id !== (duplicate?.id ?? item.id))].slice(0, MAX_SAVED_INSIGHTS);
  await writeEnvelope('meta', keyOf(input.userId, input.chartId), { userId: input.userId, chartId: input.chartId, items });
  return items[0];
}

export async function removeSavedInsight(userId: string, chartId: string, insightId: string): Promise<void> {
  if (!userId || !chartId || !insightId) return;
  const items = (await readSavedInsights(userId, chartId)).filter((item) => item.id !== insightId);
  if (!items.length) {
    await deleteKey('meta', keyOf(userId, chartId));
    return;
  }
  await writeEnvelope('meta', keyOf(userId, chartId), { userId, chartId, items });
}

export async function deleteAllSavedInsights(userId: string): Promise<number> {
  // Keys share the account prefix; using the existing cache primitives keeps purge logic bounded.
  const { deleteByPrefix } = await import('./idb');
  return deleteByPrefix('meta', `${userId}|`);
}

export async function deleteSavedInsightsForChart(userId: string, chartId: string): Promise<void> {
  if (userId && chartId) await deleteKey('meta', keyOf(userId, chartId));
}
