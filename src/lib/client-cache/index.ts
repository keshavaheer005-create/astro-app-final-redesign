/**
 * One owner for Astrovia's on-device private cache.
 *
 * Design rules (see docs/CACHING.md):
 *   1. Cache data for speed; never use cached data to prove authorization.
 *   2. A cache entry is scoped by account AND chart (AND schema/engine version).
 *   3. Signing out, switching accounts, deleting a chart or deleting account
 *      data purges the affected entries immediately.
 *   4. Nothing here is ever consulted before the server has confirmed a session.
 */
import {
  CACHE_SCHEMA_VERSION,
  CHART_ENGINE_VERSION,
  deleteByPrefix,
  deleteKey,
  isPersistent,
  keysOf,
} from './idb';
import {
  deleteAllChartSnapshots,
  deleteChartSnapshot,
  pruneStaleSnapshots,
  readChartSnapshot,
  writeChartSnapshot,
  type ChartSnapshot,
} from './charts';
import {
  deleteAllChatHistories,
  deleteChatHistory,
  readChatHistory,
  writeChatHistory,
  type CachedChatHistory,
  type CachedChatMessage,
} from './chat';

export {
  CACHE_SCHEMA_VERSION,
  CHART_ENGINE_VERSION,
  isPersistent,
  readChartSnapshot,
  writeChartSnapshot,
  deleteChartSnapshot,
  readChatHistory,
  writeChatHistory,
  deleteChatHistory,
  type ChartSnapshot,
  type CachedChatHistory,
  type CachedChatMessage,
};

/**
 * Non-sensitive pointer to the account that owns the cached data. It stores a
 * user id only — no name, email or birth data — and is used exclusively to
 * detect an account switch so the previous account's cache can be wiped.
 */
const ACCOUNT_POINTER_KEY = 'astrovia:cache:account:v1';
const SWR_PREFIX = 'astrovia:swr:';

let memoryPointer: string | null = null;

export function readAccountPointer(): string | null {
  if (typeof window === 'undefined') return memoryPointer;
  try {
    return window.localStorage.getItem(ACCOUNT_POINTER_KEY);
  } catch {
    return memoryPointer;
  }
}

function writeAccountPointer(userId: string | null): void {
  memoryPointer = userId;
  if (typeof window === 'undefined') return;
  try {
    if (userId) window.localStorage.setItem(ACCOUNT_POINTER_KEY, userId);
    else window.localStorage.removeItem(ACCOUNT_POINTER_KEY);
  } catch {
    /* private mode / quota */
  }
}

/** Delete cached rows that do not belong to `userId` (defence in depth). */
async function purgeForeignEntries(userId: string): Promise<number> {
  const prefix = `${userId}|`;
  let removed = 0;
  for (const store of ['charts', 'chat'] as const) {
    const keys = await keysOf(store);
    const foreign = keys.filter((k) => !k.startsWith(prefix));
    for (const key of foreign) {
      await deleteKey(store, key);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Called once per successful session bootstrap, AFTER the server has confirmed
 * who the user is. Wipes a previous account's cached chart/chat data and prunes
 * snapshots from an older calculation engine.
 */
export async function adoptAccount(userId: string): Promise<{ switched: boolean; purged: number }> {
  if (!userId) return { switched: false, purged: 0 };
  const previous = readAccountPointer();
  let purged = 0;
  const switched = previous !== null && previous !== userId;
  if (previous && previous !== userId) purged += await deleteAllChartSnapshots(previous) + (await deleteAllChatHistories(previous));
  // Even without a pointer (first run after an upgrade, or a cleared
  // localStorage), never leave another account's rows readable.
  purged += await purgeForeignEntries(userId);
  purged += await pruneStaleSnapshots(userId);
  writeAccountPointer(userId);
  return { switched, purged };
}

/**
 * Forget a specific account's cached data. Call on sign-out, account-data
 * deletion and account switching. Without an argument it clears every account.
 */
export async function clearAccountCache(userId?: string | null): Promise<void> {
  const target = userId ?? readAccountPointer();
  if (target) {
    await deleteAllChartSnapshots(target);
    await deleteAllChatHistories(target);
  } else {
    await deleteByPrefix('charts', '');
    await deleteByPrefix('chat', '');
  }
  if (!userId || userId === readAccountPointer()) writeAccountPointer(null);
  clearSwrCaches();
}

/** Remove the stale-while-revalidate copies of "today" data (all scopes). */
export function clearSwrCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    const drop: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(SWR_PREFIX)) drop.push(k);
    }
    for (const k of drop) window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/**
 * Purge everything this module owns. Used by "sign out" and "delete all my
 * data"; the next sign-in starts from an empty device cache.
 */
export async function clearAllClientCaches(): Promise<void> {
  await deleteByPrefix('charts', '');
  await deleteByPrefix('chat', '');
  clearSwrCaches();
  writeAccountPointer(null);
}
