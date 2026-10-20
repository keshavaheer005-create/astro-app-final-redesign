/**
 * Tiny in-memory TTL cache for expensive, pure server computations (Swiss
 * Ephemeris calls). One Node process serves the app, so a Map is enough;
 * it simply starts empty after a restart or a Render spin-down.
 */
type Entry<T> = { v: T; exp: number };
const store = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 400;

export function forget(key: string): void {
  store.delete(key);
}

export function memo<T>(key: string, ttlMs: number, produce: () => T): T {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.exp > now) {
    // refresh recency (Map keeps insertion order → cheapest LRU)
    store.delete(key);
    store.set(key, hit);
    return hit.v;
  }
  const v = produce();
  store.set(key, { v, exp: now + ttlMs });
  if (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  return v;
}
