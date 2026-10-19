/**
 * Session cookie token — signing, verification and expiry.
 *
 * Split out from `session.ts` so the exact bytes we trust can be unit-tested
 * without Next.js' `cookies()` request context.
 *
 * Token format (v2, current):
 *
 *     v2.<userId>.<issuedAtMs>.<hmac>
 *
 *  • `hmac` is HMAC-SHA256(secret, `v2.<userId>.<issuedAtMs>`) truncated to
 *    32 hex chars (128 bits).
 *  • `issuedAtMs` makes the token expirable: a leaked cookie stops working
 *    after `SESSION_TTL_MS` even though the signature is still valid.
 *
 * Legacy format (v1, pre-2026-10) was `<userId>.<hmac>` with
 * HMAC-SHA256(secret, userId) and no expiry. It is accepted ONCE so existing
 * users are not silently signed out, and every successful verification tells
 * the caller to re-issue a v2 cookie (see `verifySessionToken().needsUpgrade`).
 */
import { createHmac, timingSafeEqual } from 'crypto';

/** Cookie name. Kept for compatibility with existing deployments. */
export const SESSION_COOKIE = 'selfsage_sid';

/** How long a freshly issued session token stays valid. */
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/** Tolerated clock skew for a token issued "in the future". */
const FUTURE_SKEW_MS = 5 * 60 * 1000;

const V2_PREFIX = 'v2';
const LEGACY_SIG_LEN = 32;

export type VerifiedSession = {
  userId: string;
  /** True when an old (non-expiring) cookie was accepted → re-issue a v2 one. */
  needsUpgrade: boolean;
  issuedAt: number | null;
};

function hmacHex(secret: string, value: string, length: number): string {
  return createHmac('sha256', secret).update(value).digest('hex').slice(0, length);
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

/** A user id we are willing to put in a cookie / read back out of one. */
export function isPlausibleUserId(value: string): boolean {
  return /^[A-Za-z0-9_-]{6,64}$/.test(value);
}

/**
 * Sign a session token.
 * @param now injectable clock (tests) — defaults to `Date.now()`.
 */
export function signSessionToken(userId: string, secret: string, now: number = Date.now()): string {
  const iat = Math.floor(now);
  const payload = `${V2_PREFIX}.${userId}.${iat}`;
  return `${payload}.${hmacHex(secret, payload, LEGACY_SIG_LEN)}`;
}

/** Sign the legacy (v1) token — only used by tests / migration fixtures. */
export function signLegacySessionToken(userId: string, secret: string): string {
  return `${userId}.${hmacHex(secret, userId, LEGACY_SIG_LEN)}`;
}

/**
 * Verify a token.
 *
 * Returns `null` for anything that is not provably signed by `secret`, and for
 * v2 tokens that are expired or dated implausibly far in the future.
 * When `legacy: 'accept'` (default) a valid v1 token is accepted and flagged so
 * the caller can upgrade the cookie.
 */
export function verifySessionToken(
  token: string | null | undefined,
  secret: string,
  opts: { now?: number; ttlMs?: number; legacy?: 'accept' | 'reject' } = {},
): VerifiedSession | null {
  if (!token || !secret) return null;
  const now = opts.now ?? Date.now();
  const ttl = opts.ttlMs ?? SESSION_TTL_MS;
  const parts = token.split('.');

  if (parts[0] === V2_PREFIX) {
    if (parts.length !== 4) return null;
    const [, userId, iatRaw, sig] = parts;
    if (!isPlausibleUserId(userId)) return null;
    if (!/^\d{1,16}$/.test(iatRaw)) return null;
    const iat = Number(iatRaw);
    if (!Number.isFinite(iat)) return null;
    const expected = hmacHex(secret, `${V2_PREFIX}.${userId}.${iatRaw}`, LEGACY_SIG_LEN);
    if (!safeEqualHex(sig, expected)) return null;
    if (iat > now + FUTURE_SKEW_MS) return null;
    if (now - iat > ttl) return null;
    return { userId, needsUpgrade: false, issuedAt: iat };
  }

  // Legacy `<userId>.<sig>` (two parts, no prefix).
  if (parts.length !== 2) return null;
  if (opts.legacy === 'reject') return null;
  const [userId, sig] = parts;
  if (!isPlausibleUserId(userId)) return null;
  const expected = hmacHex(secret, userId, LEGACY_SIG_LEN);
  if (!safeEqualHex(sig, expected)) return null;
  return { userId, needsUpgrade: true, issuedAt: null };
}

/** Cookie attributes shared by every environment. */
export function sessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: isProduction,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}
