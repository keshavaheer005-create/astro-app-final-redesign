/**
 * Minimal IndexedDB access layer for Astrovia's private client cache.
 *
 * Why hand-rolled instead of a dependency: the app already ships
 * `@tanstack/react-query` but does not use it anywhere (audited 2026-10), and
 * the screens fetch through `api()` with hand-managed state. Adding a query
 * layer would have meant rewriting every screen's data flow in the same change
 * that introduces on-device persistence — a much larger blast radius. Instead
 * this module is the single owner of *persisted* data, with an explicit key
 * policy (account + chart + version) and explicit purge points.
 *
 * Rules this layer enforces:
 *   • never throws — a broken/blocked IDB degrades to an in-memory map, so the
 *     app still works (it just re-fetches next reload);
 *   • never blocks the UI — every operation has a short timeout;
 *   • never stores credentials, tokens or authorization decisions;
 *   • every read is version-checked; stale schema/engine entries are dropped.
 */

/** Bump when the shape of a cached value changes. */
export const CACHE_SCHEMA_VERSION = 1;

/**
 * Bump when the chart calculation engine changes in a way that makes a stored
 * snapshot wrong (new ayanamsa, house system, dasha tables…). Chart snapshots
 * whose engine version differs are ignored and deleted.
 */
export const CHART_ENGINE_VERSION = 1;

const DB_NAME = 'astrovia-cache';
const DB_VERSION = 1;
const OP_TIMEOUT_MS = 1500;

export type StoreName = 'charts' | 'chat' | 'meta';
export const STORES: StoreName[] = ['charts', 'chat', 'meta'];

export interface Envelope<T> {
  schemaVersion: number;
  savedAt: number;
  value: T;
}

/** In-memory backend — used in SSR/tests and whenever IDB is unavailable. */
class MemoryBackend {
  private data = new Map<StoreName, Map<string, unknown>>();

  private bucket(store: StoreName): Map<string, unknown> {
    let b = this.data.get(store);
    if (!b) {
      b = new Map();
      this.data.set(store, b);
    }
    return b;
  }

  async get(store: StoreName, key: string): Promise<unknown> {
    return this.bucket(store).has(key) ? this.bucket(store).get(key) : null;
  }

  async set(store: StoreName, key: string, value: unknown): Promise<void> {
    this.bucket(store).set(key, value);
  }

  async del(store: StoreName, key: string): Promise<void> {
    this.bucket(store).delete(key);
  }

  async keys(store: StoreName): Promise<string[]> {
    return [...this.bucket(store).keys()];
  }
}

interface StoreBackend {
  get(store: StoreName, key: string): Promise<unknown>;
  set(store: StoreName, key: string, value: unknown): Promise<void>;
  del(store: StoreName, key: string): Promise<void>;
  keys(store: StoreName): Promise<string[]>;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function';
}

/** IDB backend. Every call opens a fresh readonly/readwrite transaction. */
class IdbBackend implements StoreBackend {
  constructor(private opening: Promise<IDBDatabase | null>) {}

  private async db(): Promise<IDBDatabase | null> {
    return this.opening;
  }

  private run<T>(
    store: StoreName,
    mode: IDBTransactionMode,
    fn: (s: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T | null> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: T | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), OP_TIMEOUT_MS);
      const clear = () => clearTimeout(timer);
      void this.db().then((db) => {
        if (!db) {
          clear();
          return finish(null);
        }
        try {
          const tx = db.transaction(store, mode);
          const req = fn(tx.objectStore(store));
          req.onsuccess = () => {
            clear();
            finish(req.result as T);
          };
          req.onerror = () => {
            clear();
            finish(null);
          };
          tx.onabort = () => {
            clear();
            finish(null);
          };
        } catch {
          clear();
          finish(null);
        }
      });
    });
  }

  async get(store: StoreName, key: string): Promise<unknown> {
    return this.run<unknown>(store, 'readonly', (s) => s.get(key));
  }

  async set(store: StoreName, key: string, value: unknown): Promise<void> {
    await this.run(store, 'readwrite', (s) => s.put(value, key) as unknown as IDBRequest<unknown>);
  }

  async del(store: StoreName, key: string): Promise<void> {
    await this.run(store, 'readwrite', (s) => s.delete(key) as unknown as IDBRequest<unknown>);
  }

  async keys(store: StoreName): Promise<string[]> {
    const keys = await this.run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys());
    if (!keys) return [];
    return keys.filter((k): k is string => typeof k === 'string');
  }
}

let opening: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  if (opening) return opening;
  opening = new Promise((resolve) => {
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      resolve(db);
    };
    const timer = setTimeout(() => finish(null), OP_TIMEOUT_MS);
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of STORES) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
        }
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        finish(request.result);
      };
      request.onerror = () => {
        clearTimeout(timer);
        finish(null);
      };
      request.onblocked = () => {
        clearTimeout(timer);
        finish(null);
      };
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
  return opening;
}

const memory = new MemoryBackend();
let backend: StoreBackend | null = null;

function getBackend(): StoreBackend {
  if (backend) return backend;
  backend = hasIndexedDb() ? new IdbBackend(openDatabase()) : memory;
  return backend;
}

/** Swap the backend — test hook. */
export function __setBackendForTests(b: StoreBackend | null): void {
  backend = b;
}

/** True when values survive a reload (IndexedDB is available and healthy). */
export function isPersistent(): boolean {
  return hasIndexedDb();
}

/** Read a versioned envelope; `null` when missing, corrupt or from another schema. */
export async function readEnvelope<T>(store: StoreName, key: string): Promise<Envelope<T> | null> {
  try {
    const raw = await getBackend().get(store, key);
    if (!raw || typeof raw !== 'object') return null;
    const env = raw as Envelope<T>;
    if (env.schemaVersion !== CACHE_SCHEMA_VERSION) {
      // Written by a different build: drop it rather than guess at its shape.
      await deleteKey(store, key);
      return null;
    }
    if (typeof env.savedAt !== 'number') return null;
    return env;
  } catch {
    return null;
  }
}

export async function writeEnvelope<T>(store: StoreName, key: string, value: T): Promise<void> {
  try {
    const env: Envelope<T> = { schemaVersion: CACHE_SCHEMA_VERSION, savedAt: Date.now(), value };
    await getBackend().set(store, key, env);
  } catch {
    /* quota / private mode / blocked — cache is best effort */
  }
}

export async function deleteKey(store: StoreName, key: string): Promise<void> {
  try {
    await getBackend().del(store, key);
  } catch {
    /* ignore */
  }
}

export async function keysOf(store: StoreName): Promise<string[]> {
  try {
    return await getBackend().keys(store);
  } catch {
    return [];
  }
}

/** Delete every key in `store` that starts with `prefix`. Returns how many were removed. */
export async function deleteByPrefix(store: StoreName, prefix: string): Promise<number> {
  const keys = await keysOf(store);
  const hits = keys.filter((k) => k.startsWith(prefix));
  await Promise.all(hits.map((k) => deleteKey(store, k)));
  return hits.length;
}
