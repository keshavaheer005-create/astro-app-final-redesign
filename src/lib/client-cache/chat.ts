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
import { deleteByPrefix, deleteKey, keysOf, readEnvelope, writeEnvelope } from './idb';
import { stripMarkdownPreview } from '@/lib/utils';

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

export interface CachedChatSummary {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  messageCount: number;
}

/** How much recent conversation is kept on the device. */
export const MAX_CACHED_MESSAGES = 40;
/** Keep offline instant-open cache bounded even if the user creates many chats. */
export const MAX_CACHED_CONVERSATIONS = 12;

/**
 * Legacy history keeps its original key so existing installs can still paint
 * their old transcript. New conversations add a conversation id to the key,
 * preventing one chat from flashing into another while the server responds.
 */
export function chatCacheKey(userId: string, chartId: string, conversationId?: string): string {
  return conversationId ? `${userId}|${chartId}|${conversationId}` : `${userId}|${chartId}`;
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

export async function readChatHistory(
  userId: string,
  chartId: string,
  conversationId?: string,
): Promise<CachedChatHistory | null> {
  if (!userId || !chartId) return null;
  const env = await readEnvelope<{
    userId: string;
    chartId: string;
    conversationId?: string;
    messages: CachedChatMessage[];
  }>('chat', chatCacheKey(userId, chartId, conversationId));
  if (!env?.value) return null;
  const { userId: storedUser, chartId: storedChart, conversationId: storedConversation, messages } = env.value;
  if (storedUser !== userId || storedChart !== chartId || storedConversation !== conversationId) return null;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  return { messages: trimChatHistory(messages), savedAt: env.savedAt };
}

async function pruneConversationCache(userId: string, chartId: string, keepKey: string): Promise<void> {
  const prefix = `${userId}|${chartId}|`;
  const keys = (await keysOf('chat')).filter((key) => key.startsWith(prefix));
  if (keys.length <= MAX_CACHED_CONVERSATIONS) return;
  const entries = await Promise.all(keys.map(async (key) => {
    const env = await readEnvelope<{ userId: string; chartId: string; conversationId?: string; messages: CachedChatMessage[] }>('chat', key);
    return { key, savedAt: env?.savedAt ?? 0 };
  }));
  entries.sort((a, b) => {
    if (a.key === keepKey) return -1;
    if (b.key === keepKey) return 1;
    return b.savedAt - a.savedAt;
  });
  await Promise.all(entries.slice(MAX_CACHED_CONVERSATIONS).map(({ key }) => deleteKey('chat', key)));
}

/**
 * Fast local summaries for the history drawer. This only reads the already
 * bounded, account+chart scoped chat cache; the server list replaces this
 * provisional list as soon as it responds.
 */
export async function readCachedChatSummaries(userId: string, chartId: string): Promise<CachedChatSummary[]> {
  if (!userId || !chartId) return [];
  const legacyKey = chatCacheKey(userId, chartId);
  const prefix = `${userId}|${chartId}|`;
  const keys = (await keysOf('chat')).filter((key) => key === legacyKey || key.startsWith(prefix));
  const summaries = await Promise.all(keys.map(async (key): Promise<(CachedChatSummary & { savedAt: number }) | null> => {
    const envelope = await readEnvelope<{
      userId: string;
      chartId: string;
      conversationId?: string;
      messages: CachedChatMessage[];
    }>('chat', key);
    const value = envelope?.value;
    if (!value || value.userId !== userId || value.chartId !== chartId || !Array.isArray(value.messages)) return null;
    const conversationId = key === legacyKey ? undefined : key.slice(prefix.length);
    if (value.conversationId !== conversationId) return null;
    const messages = trimChatHistory(value.messages);
    if (!messages.length) return null;
    const firstUser = messages.find((message) => message.role === 'user');
    const last = messages[messages.length - 1];
    const time = last.createdAt && !Number.isNaN(Date.parse(last.createdAt))
      ? new Date(last.createdAt).toISOString()
      : new Date(envelope.savedAt).toISOString();
    return {
      id: conversationId ?? 'legacy',
      title: stripMarkdownPreview(firstUser?.content ?? '').slice(0, 72) || 'Astrovia AI chat',
      preview: stripMarkdownPreview(last.content).slice(0, 72),
      updatedAt: time,
      messageCount: messages.length,
      savedAt: envelope.savedAt,
    };
  }));
  return summaries
    .filter((item): item is CachedChatSummary & { savedAt: number } => Boolean(item))
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_CACHED_CONVERSATIONS + 1)
    .map(({ savedAt: _savedAt, ...summary }) => summary);
}

export async function writeChatHistory(
  userId: string,
  chartId: string,
  messages: ReadonlyArray<Partial<CachedChatMessage> & { streaming?: boolean; pending?: boolean }>,
  conversationId?: string,
): Promise<void> {
  if (!userId || !chartId) return;
  const trimmed = trimChatHistory(messages);
  if (trimmed.length === 0) {
    await deleteChatHistory(userId, chartId, conversationId);
    return;
  }
  const key = chatCacheKey(userId, chartId, conversationId);
  await writeEnvelope('chat', key, {
    userId,
    chartId,
    ...(conversationId ? { conversationId } : {}),
    messages: trimmed,
  });
  if (conversationId) void pruneConversationCache(userId, chartId, key);
}

export async function deleteChatHistory(userId: string, chartId: string, conversationId?: string): Promise<void> {
  if (!userId || !chartId) return;
  await deleteKey('chat', chatCacheKey(userId, chartId, conversationId));
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