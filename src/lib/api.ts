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

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
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
