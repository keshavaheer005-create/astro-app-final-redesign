/**
 * Astrovia Client Offline & IndexedDB Caching Engine.
 *
 * Provides ultra-fast Stale-While-Revalidate (SWR) caching for:
 *   • Acharya Chat History (per chart)
 *   • Daily Check-ins & Karma Journal entries
 *   • Computed Kundli birth charts & divisional diagrams
 *   • Panchang, transits, and daily sky highlights
 *
 * Architecture:
 *   Level 1: Fast in-memory Map (0ms synchronous retrieval during active session)
 *   Level 2: IndexedDB asynchronous object store (no 5MB localstorage limit)
 *   Level 3: LocalStorage fallback for lightweight flags & critical state
 */

const DB_NAME = 'astrovia_cache_v1';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

// In-memory L1 cache
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Retrieve item from memory, IndexedDB, or localStorage fallback. */
export async function getCachedItem<T>(key: string): Promise<T | null> {
  const now = Date.now();

  // 1. Check L1 Memory cache
  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > now) {
    return mem.data as T;
  }

  // 2. Check IndexedDB
  try {
    const db = await openDb();
    if (db) {
      const value = await new Promise<{ data: T; expiresAt: number } | null>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (value && value.expiresAt > now) {
        memoryCache.set(key, value);
        return value.data;
      }
    }
  } catch {
    /* proceed to localStorage fallback */
  }

  // 3. Check LocalStorage fallback
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(`ss_cache_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: T; expiresAt: number };
        if (parsed.expiresAt > now) {
          memoryCache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

/** Store item into memory and IndexedDB (with localStorage fallback). */
export async function setCachedItem<T>(
  key: string,
  data: T,
  ttlMs = 7 * 24 * 60 * 60 * 1000, // Default 7 days
): Promise<void> {
  const payload = {
    data,
    expiresAt: Date.now() + ttlMs,
  };

  // 1. Set L1 memory cache
  memoryCache.set(key, payload);

  // 2. Set IndexedDB
  try {
    const db = await openDb();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put(payload, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {
    /* fallback to localStorage */
  }

  // 3. Fallback save to localStorage for small data
  if (typeof window !== 'undefined') {
    try {
      const str = JSON.stringify(payload);
      if (str.length < 50_000) {
        window.localStorage.setItem(`ss_cache_${key}`, str);
      }
    } catch {
      /* ignore quota errors */
    }
  }
}

/** Clear specific cached key or pattern */
export async function removeCachedItem(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    const db = await openDb();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(`ss_cache_${key}`);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Stale-While-Revalidate wrapper.
 * Emits cached value immediately (if available) with isFromCache: true,
 * then fetches from network in background and emits fresh value if changed.
 */
export async function executeSWR<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  onData: (data: T, isFromCache: boolean) => void,
  options?: { ttlMs?: number },
): Promise<void> {
  // 1. Emit cached data immediately if present
  const cached = await getCachedItem<T>(cacheKey);
  if (cached != null) {
    onData(cached, true);
  }

  // 2. Fetch fresh from network
  try {
    const fresh = await fetcher();
    if (fresh != null) {
      await setCachedItem(cacheKey, fresh, options?.ttlMs);
      onData(fresh, false);
    }
  } catch (err) {
    // If we had cached data, silently keep it. Otherwise rethrow.
    if (cached == null) {
      throw err;
    }
  }
}
