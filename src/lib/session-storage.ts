/**
 * Client-side session-token fallback storage.
 *
 * The real session lives in an httpOnly cookie. But when the app runs inside
 * an embedded preview (cross-origin iframe) or under strict third-party-cookie
 * blocking, the browser silently refuses to store/send that cookie and every
 * refresh looks like a logout. In that case the client replays the signed
 * token it received at sign-in via the `x-session-token` header; the server
 * verifies it with the exact same HMAC check as the cookie and re-seats the
 * cookie. Nothing here bypasses authentication — the token is only issued by
 * the server after a successful sign-in and cannot be forged.
 */
import { SESSION_TOKEN_HEADER, SESSION_TOKEN_STORAGE_KEY } from '@/lib/session-constants';

export function saveSessionToken(token: string): void {
  try {
    window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
  } catch {
    /* storage unavailable (private mode / quota) — cookie alone still works */
  }
}

export function readSessionToken(): string | null {
  try {
    return window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearSessionToken(): void {
  try {
    window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Headers to attach to an API call so the server can recover the session. */
export function sessionHeader(): Record<string, string> {
  const token = readSessionToken();
  return token ? { [SESSION_TOKEN_HEADER]: token } : {};
}
