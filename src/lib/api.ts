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
  const res = await fetch(apiUrl(url), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
    if (body.error === 'signin_required') notifySignInRequired(body.reason);
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Identical GETs fired at the same moment (Home + reminders + a re-render…) share ONE request. */
const inflight = new Map<string, Promise<unknown>>();

export function api<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method !== 'GET' || init?.signal) return doFetch<T>(url, init);
  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;
  const p = doFetch<T>(url, init).finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

/* ── Stale-while-revalidate for "today" data ─────────────────────────────── */

const SWR_PREFIX = 'astrovia:swr:';
const SWR_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Paints the last known answer INSTANTLY (from this device), then refreshes it
 * from the server and updates again. `scope` must change whenever the answer
 * could be different (chart + today's date), so stale data is never shown for
 * the wrong day. Errors are swallowed: callers treat this data as best-effort.
 */
export async function apiSWR<T>(
  url: string,
  init: RequestInit | undefined,
  scope: string,
  onData: (data: T) => void,
  isCancelled: () => boolean,
): Promise<void> {
  const key = `${SWR_PREFIX}${scope}|${url}|${typeof init?.body === 'string' ? init.body : ''}`;
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    if (raw) {
      const hit = JSON.parse(raw) as { t: number; d: T };
      if (Date.now() - hit.t < SWR_MAX_AGE_MS && !isCancelled()) onData(hit.d);
    }
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
    /* keep whatever the cache painted */
  }
}

/** Forget cached daily data (sign-out, "clear all my data"). */
export function clearSwrCache(): void {
  try {
    const drop: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(SWR_PREFIX)) drop.push(k);
    }
    drop.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
