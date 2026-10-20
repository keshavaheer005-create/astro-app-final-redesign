/// <reference types="bun-types" />
/**
 * Acharya history cache: bounded, chart-scoped, and never persisting a turn the
 * server has not confirmed.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import {
  MAX_CACHED_MESSAGES,
  MAX_CACHED_CONVERSATIONS,
  chatCacheKey,
  deleteAllChatHistories,
  deleteChatHistory,
  readCachedChatSummaries,
  readChatHistory,
  reconcileHistory,
  trimChatHistory,
  writeChatHistory,
  type CachedChatMessage,
} from '../../src/lib/client-cache/chat';
import { deleteByPrefix } from '../../src/lib/client-cache/idb';

const USER = 'user_aaaaaaaaaaaa';
const CHART = 'chart_one';
const OTHER_CHART = 'chart_two';

const msg = (id: string, over: Partial<CachedChatMessage> = {}): CachedChatMessage => ({
  id,
  role: 'user',
  content: `message ${id}`,
  ...over,
});

describe('trimChatHistory', () => {
  test('drops streaming and unconfirmed messages', () => {
    const out = trimChatHistory([
      { id: '1', role: 'user', content: 'hello', streaming: true },
      { id: '2', role: 'assistant', content: 'streamed but unconfirmed', pending: true },
      { id: '3', role: 'assistant', content: 'confirmed' },
    ]);
    expect(out.map((m) => m.id)).toEqual(['3']);
  });

  test('drops empty content and invalid roles', () => {
    const out = trimChatHistory([
      { id: '1', role: 'user', content: '   ' },
      { id: '2', role: 'assistant', content: 'ok' },
      // @ts-expect-error deliberately invalid role
      { id: '3', role: 'system', content: 'nope' },
      { id: '', role: 'user', content: 'no id' },
    ]);
    expect(out.map((m) => m.id)).toEqual(['2']);
  });

  test('keeps only the newest MAX_CACHED_MESSAGES, in order', () => {
    const all = Array.from({ length: MAX_CACHED_MESSAGES + 15 }, (_, i) => msg(`m${i}`));
    const out = trimChatHistory(all);
    expect(out).toHaveLength(MAX_CACHED_MESSAGES);
    expect(out[0].id).toBe('m15');
    expect(out[out.length - 1].id).toBe(`m${MAX_CACHED_MESSAGES + 14}`);
  });
});

describe('chat history store', () => {
  beforeEach(async () => {
    await deleteByPrefix('chat', '');
  });

  test('is keyed by account AND chart', async () => {
    expect(chatCacheKey(USER, CHART)).toBe(`${USER}|${CHART}`);
    await writeChatHistory(USER, CHART, [msg('1'), msg('2', { role: 'assistant' })]);

    const hit = await readChatHistory(USER, CHART);
    expect(hit?.messages).toHaveLength(2);

    // The same account on another chart must not see this conversation.
    expect(await readChatHistory(USER, OTHER_CHART)).toBeNull();
    // Nor another account on the same chart id.
    expect(await readChatHistory('user_cccccccccccc', CHART)).toBeNull();
  });

  test('separates new conversations while retaining the legacy cache key', async () => {
    const first = 'chat_aaaaaaaaaaaa';
    const second = 'chat_bbbbbbbbbbbb';
    expect(chatCacheKey(USER, CHART, first)).toBe(`${USER}|${CHART}|${first}`);
    expect(chatCacheKey(USER, CHART)).toBe(`${USER}|${CHART}`);
    await writeChatHistory(USER, CHART, [msg('a')], first);
    await writeChatHistory(USER, CHART, [msg('b')], second);
    await writeChatHistory(USER, CHART, [msg('legacy')]);
    expect((await readChatHistory(USER, CHART, first))?.messages[0].id).toBe('a');
    expect((await readChatHistory(USER, CHART, second))?.messages[0].id).toBe('b');
    expect((await readChatHistory(USER, CHART))?.messages[0].id).toBe('legacy');
    expect(await readChatHistory(USER, CHART, 'chat_cccccccccccc')).toBeNull();
  });

  test('bounds conversation cache growth', async () => {
    for (let i = 0; i < MAX_CACHED_CONVERSATIONS + 3; i++) {
      await writeChatHistory(USER, CHART, [msg(`m${i}`)], `chat_${String(i).padStart(12, '0')}`);
    }
    // Pruning is deliberately best-effort/background, so yield before asserting.
    await new Promise((resolve) => setTimeout(resolve, 40));
    const { keysOf } = await import('../../src/lib/client-cache/idb');
    const scoped = (await keysOf('chat')).filter((key) => key.startsWith(`${USER}|${CHART}|`));
    expect(scoped.length).toBeLessThanOrEqual(MAX_CACHED_CONVERSATIONS);
  });

  test('lists only cached conversations for the requested account and chart', async () => {
    const id = 'conversation_abcdefgh';
    await writeChatHistory(USER, CHART, [
      msg('u1', { content: 'How does my Moon sign affect me?', createdAt: '2026-10-19T08:00:00.000Z' }),
      msg('a1', { role: 'assistant', content: 'Your Moon sign relates to emotional patterns.', createdAt: '2026-10-19T08:00:01.000Z' }),
    ], id);
    await writeChatHistory(USER, OTHER_CHART, [msg('other', { content: 'Private other chart' })], 'conversation_otherchart');

    const summaries = await readCachedChatSummaries(USER, CHART);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe(id);
    expect(summaries[0].title).toBe('How does my Moon sign affect me?');
    expect(summaries[0].preview).toBe('Your Moon sign relates to emotional patterns.');
    expect(summaries[0].messageCount).toBe(2);
  });

  test('isolates multiple conversations for the same account and chart', async () => {
    const firstConversation = 'conversation_abcdefgh';
    const secondConversation = 'conversation_ijklmnop';
    expect(chatCacheKey(USER, CHART, firstConversation)).toBe(`${USER}|${CHART}|${firstConversation}`);
    await writeChatHistory(USER, CHART, [msg('first', { content: 'first chat' })], firstConversation);
    await writeChatHistory(USER, CHART, [msg('second', { content: 'second chat' })], secondConversation);

    expect((await readChatHistory(USER, CHART, firstConversation))?.messages[0].content).toBe('first chat');
    expect((await readChatHistory(USER, CHART, secondConversation))?.messages[0].content).toBe('second chat');
    expect(await readChatHistory(USER, CHART)).toBeNull();
  });

  test('preserves journal threading and server timestamps', async () => {
    await writeChatHistory(USER, CHART, [
      msg('1', { journalRef: '2026-09-26', createdAt: '2026-09-26T10:00:00.000Z' }),
    ]);
    const hit = await readChatHistory(USER, CHART);
    expect(hit?.messages[0].journalRef).toBe('2026-09-26');
    expect(hit?.messages[0].createdAt).toBe('2026-09-26T10:00:00.000Z');
  });

  test('writing nothing removes the entry instead of keeping an empty one', async () => {
    await writeChatHistory(USER, CHART, [msg('1')]);
    await writeChatHistory(USER, CHART, []);
    expect(await readChatHistory(USER, CHART)).toBeNull();
  });

  test('per-chart and per-account deletion', async () => {
    await writeChatHistory(USER, CHART, [msg('1')]);
    await writeChatHistory(USER, OTHER_CHART, [msg('2')]);

    await deleteChatHistory(USER, CHART);
    expect(await readChatHistory(USER, CHART)).toBeNull();
    expect(await readChatHistory(USER, OTHER_CHART)).not.toBeNull();

    expect(await deleteAllChatHistories(USER)).toBe(1);
    expect(await readChatHistory(USER, OTHER_CHART)).toBeNull();
  });

  test('reconcile: server list wins, cache is the fallback only', () => {
    const cached = [msg('cached', { content: 'old' })];
    const server = [msg('server', { content: 'fresh' })];
    expect(reconcileHistory(cached, server).map((m) => m.id)).toEqual(['server']);
    expect(reconcileHistory(cached, []).map((m) => m.id)).toEqual(['cached']);
  });
});
