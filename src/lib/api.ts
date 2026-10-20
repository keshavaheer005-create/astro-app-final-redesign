/**
 * Central API access layer.
 *
 * In the browser (and in the Capacitor WebView when it loads the deployed
 * site), API calls are same-origin relative paths like `/api/charts`.
 *
 * When the app is packaged for Android/iOS WITHOUT loading the remote URL
 * (i.e. bundled assets), set NEXT_PUBLIC_API_BASE_URL to the deployed
 * backend base (e.g. https://astrovia.example.com) and every call made
 * through `api()` / `apiUrl()` is prefixed automatically — no localhost
 * is ever baked into the bundle.
 */
import { clearSwrCaches, readAccountPointer } from '@/lib/client-cache';
import { count, elapsed, end, start } from '@/lib/perf';

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
}

/** Tells the app to open the "sign in to continue" popup (guest hit a member-only feature). */
export function notifySignInRequired(reason?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ss:signin-required', { detail: { reason } }));
  }
}

async function doFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const t0 = start();
  try {
    const res = await fetch(apiUrl(url), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
      if (body.error === 'signin_required') notifySignInRequired(body.reason);
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    // Count every call; keep a timing entry only for calls slow enough to matter
    // (the perf buffer is bounded, and sub-150ms calls are noise).
    const route = url.split('?')[0];
    count('api.request');
    count(`api.request ${route}`);
    if (elapsed(t0) >= 150) {
      count('api.slow(>=150ms)');
      end('api.fetch.slow', t0, { route });
    }
  }
}

/** Identical GETs fired at the same moment (Home + reminders + a re-render…) share ONE request. */
const inflight = new Map<string, Promise<unknown>>();

export function api<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method !== 'GET' || init?.signal) return doFetch<T>(url, init);
  const existing = inflight.get(url);
  if (existing) {
    count('api.dedupe');
    return existing as Promise<T>;
  }
  const p = doFetch<T>(url, init).finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

/* ── Stale-while-revalidate for "today" data ─────────────────────────────── */

const SWR_PREFIX = 'astrovia:swr:';
const SWR_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function swrKey(url: string, init: RequestInit | undefined, scope: string): string {
  const account = readAccountPointer() ?? 'anon';
  return `${SWR_PREFIX}${account}|${scope}|${url}|${typeof init?.body === 'string' ? init.body : ''}`;
}

/**
 * Paints the last known answer INSTANTLY (from this device), then refreshes it
 * from the server and updates again. `scope` must change whenever the answer
 * could be different (chart + today's date), so stale data is never shown for
 * the wrong day. Errors are swallowed: callers treat this data as best-effort.
 *
 * The key is automatically prefixed with the signed-in account, so a second
 * person using the same device can never be shown the first person's cached
 * "today" data.
 *
 * `opts.freshMs` — if a copy was written less than this many milliseconds ago,
 * paint it and SKIP the network entirely. That is what makes returning to a
 * screen within the freshness window free instead of a re-fetch.
 * `opts.onError` — called only when the fetch failed AND there was nothing to
 * paint, i.e. exactly when the screen would otherwise sit empty.
 */
export async function apiSWR<T>(
  url: string,
  init: RequestInit | undefined,
  scope: string,
  onData: (data: T) => void,
  isCancelled: () => boolean,
  opts?: { freshMs?: number; onError?: () => void },
): Promise<void> {
  const key = swrKey(url, init, scope);
  let paintedAt = 0;
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    if (raw) {
      const hit = JSON.parse(raw) as { t: number; d: T };
      if (Date.now() - hit.t < SWR_MAX_AGE_MS && !isCancelled()) {
        onData(hit.d);
        paintedAt = hit.t;
        count('cache.swr.hit');
        if (opts?.freshMs && Date.now() - hit.t < opts.freshMs) {
          count('cache.swr.fresh-skip');
          return;
        }
      }
    }
    if (!paintedAt) count('cache.swr.miss');
  } catch {
    /* storage unavailable or corrupt → just fetch */
  }
  try {
    const fresh = await api<T>(url, init);
    if (isCancelled()) return;
    onData(fresh);
    try {
      window.localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: fresh }));
    } catch {
      /* quota / private mode */
    }
  } catch {
    // Keep whatever the cache painted. Report the failure only when the caller
    // would otherwise show an empty screen.
    if (!paintedAt) opts?.onError?.();
  }
}

/**
 * Overwrite a stale-while-revalidate entry after a mutation, so the next mount
 * paints the value we just confirmed instead of the pre-mutation copy.
 */
export function apiSWRWrite<T>(url: string, init: RequestInit | undefined, scope: string, data: T): void {
  try {
    window.localStorage.setItem(swrKey(url, init, scope), JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    /* quota / private mode */
  }
}

/** Forget cached daily data (sign-out, "clear all my data"). */
export function clearSwrCache(): void {
  clearSwrCaches();
}
