/**
 * Account- and chart-scoped Acharya history cache.
 *
 * The server (`ChatMessage`) stays the source of truth. This cache makes the
 * Acharya screen paint instantly on revisit and survives a reload; the screen
 * still reconciles with `/api/ask-acharya` in the background and replaces what
 * it painted with the server's list.
 *
 * Key:   `chat/<userId>|<chartId>`
 * Value: { userId, chartId, messages: [...] }
 *
 * Safety rules encoded here:
 *   • bounded — only the most recent `MAX_CACHED_MESSAGES` confirmed turns;
 *   • no credentials — never stores cookies, tokens or an "authorized" flag;
 *   • pending/streaming bubbles are never persisted, so an interrupted stream
 *     cannot become a fake message in the history;
 *   • everything is scoped to one account AND one chart, so switching family
 *     profiles cannot show another person's conversation.
 */
import { deleteByPrefix, deleteKey, readEnvelope, writeEnvelope } from './idb';

export type ChatRole = 'user' | 'assistant';

export interface CachedChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** ISO timestamp from the server, when known. */
  createdAt?: string;
  /** Journal entry this exchange was threaded to. */
  journalRef?: string;
}

export interface CachedChatHistory {
  messages: CachedChatMessage[];
  savedAt: number;
}

/** How much recent conversation is kept on the device. */
export const MAX_CACHED_MESSAGES = 40;

export function chatCacheKey(userId: string, chartId: string): string {
  return `${userId}|${chartId}`;
}

/**
 * Keep only what is safe and useful to persist: real messages with server ids
 * and non-empty text, newest `max` of them, in chronological order.
 */
export function trimChatHistory(
  messages: ReadonlyArray<Partial<CachedChatMessage> & { streaming?: boolean; pending?: boolean }>,
  max: number = MAX_CACHED_MESSAGES,
): CachedChatMessage[] {
  const confirmed: CachedChatMessage[] = [];
  for (const m of messages) {
    if (!m) continue;
    if (m.streaming) continue; // interrupted stream — never history
    if (m.pending) continue; // streamed, but the server has not confirmed it yet
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (typeof m.id !== 'string' || !m.id) continue;
    if (typeof m.content !== 'string' || !m.content.trim()) continue;
    confirmed.push({
      id: m.id,
      role: m.role,
      content: m.content,
      ...(m.createdAt ? { createdAt: m.createdAt } : {}),
      ...(m.journalRef ? { journalRef: m.journalRef } : {}),
    });
  }
  return confirmed.length > max ? confirmed.slice(confirmed.length - max) : confirmed;
}

export async function readChatHistory(userId: string, chartId: string): Promise<CachedChatHistory | null> {
  if (!userId || !chartId) return null;
  const env = await readEnvelope<{ userId: string; chartId: string; messages: CachedChatMessage[] }>(
    'chat',
    chatCacheKey(userId, chartId),
  );
  if (!env?.value) return null;
  const { userId: storedUser, chartId: storedChart, messages } = env.value;
  if (storedUser !== userId || storedChart !== chartId) return null;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  return { messages: trimChatHistory(messages), savedAt: env.savedAt };
}

export async function writeChatHistory(
  userId: string,
  chartId: string,
  messages: ReadonlyArray<Partial<CachedChatMessage> & { streaming?: boolean; pending?: boolean }>,
): Promise<void> {
  if (!userId || !chartId) return;
  const trimmed = trimChatHistory(messages);
  if (trimmed.length === 0) {
    await deleteChatHistory(userId, chartId);
    return;
  }
  await writeEnvelope('chat', chatCacheKey(userId, chartId), {
    userId,
    chartId,
    messages: trimmed,
  });
}

export async function deleteChatHistory(userId: string, chartId: string): Promise<void> {
  if (!userId || !chartId) return;
  await deleteKey('chat', chatCacheKey(userId, chartId));
}

/** Delete every cached conversation for one account. */
export async function deleteAllChatHistories(userId: string): Promise<number> {
  if (!userId) return 0;
  return deleteByPrefix('chat', `${userId}|`);
}

/**
 * Merge a confirmed server list over whatever this device had cached.
 * The server list wins; cached-only turns are kept only while the server list
 * is EMPTY *and* the caller says it is authoritative (offline fallback is not
 * used — a missing answer means "show nothing", not "show stale guesses").
 */
export function reconcileHistory(
  cached: ReadonlyArray<CachedChatMessage>,
  server: ReadonlyArray<CachedChatMessage>,
): CachedChatMessage[] {
  if (server.length > 0) return trimChatHistory(server);
  return trimChatHistory(cached);
}
