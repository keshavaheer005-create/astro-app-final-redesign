import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { getSessionSecret } from '@/lib/env';
import {
  SESSION_COOKIE,
  SESSION_TOKEN_HEADER,
  sessionCookieOptions,
  signSessionToken,
  verifySessionToken,
} from '@/lib/session-token';

/**
 * Signed, expiring session cookie.
 *
 * The cookie carries `<userId>.<issuedAt>.<hmac>` (see `session-token.ts`), so
 * a token stops working after the TTL even if it leaks. Cookies issued by the
 * previous, non-expiring format are accepted once and upgraded in place.
 *
 * Every API route that needs the caller's identity goes through here; nothing
 * else trusts a client-supplied id.
 */

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  const verified = verifySessionToken(raw, getSessionSecret(), { legacy: 'accept' });
  if (verified) {
    if (verified.needsUpgrade) {
      // Legacy cookie: it proves identity but has no expiry, so replace it with
      // a v2 token right away. `cookies().set` is allowed in route handlers and
      // server actions; when it is not, the caller still gets a valid user id.
      try {
        await setSessionCookie(verified.userId);
      } catch {
        /* read-only cookie context (e.g. RSC render) — upgraded on next POST */
      }
    }
    return verified.userId;
  }
  // Cookie could not be read (embedded preview dropping SameSite cookies, or
  // strict third-party-cookie blocking). The client re-sends the SAME signed
  // token in `x-session-token`; it passes the identical HMAC verification, so
  // this is no weaker than the cookie path — and we re-seat the cookie while
  // we are here so the browser recovers on its own.
  try {
    const h = await headers();
    const headerToken = h.get(SESSION_TOKEN_HEADER);
    const fromHeader = verifySessionToken(headerToken, getSessionSecret(), { legacy: 'reject' });
    if (fromHeader) {
      try {
        await setSessionCookie(fromHeader.userId);
      } catch {
        /* read-only cookie context — header keeps working either way */
      }
      return fromHeader.userId;
    }
  } catch {
    /* headers() unavailable outside a request scope */
  }
  return null;
}

/** True when the request arrived through an HTTPS reverse proxy / preview. */
async function isProxiedHttps(): Promise<boolean> {
  try {
    const h = await headers();
    const proto = (h.get('x-forwarded-proto') ?? '').split(',')[0].trim().toLowerCase();
    return proto === 'https';
  } catch {
    return false;
  }
}

/**
 * Sign a fresh session for `userId`, set the cookie and return the token so
 * the route handler can hand it to the client as the header fallback.
 */
export async function issueSession(userId: string): Promise<string> {
  const token = signSessionToken(userId, getSessionSecret());
  const jar = await cookies();
  // Cross-site cookie shape when served through an HTTPS proxy (embedded
  // previews), or when explicitly forced via env; top-level plain deployments
  // keep SameSite=Lax. Never `none` without `secure` — browsers reject that.
  const crossSite = (await isProxiedHttps()) || process.env.SESSION_COOKIE_SAMESITE === 'none';
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(crossSite));
  return token;
}

export async function setSessionCookie(userId: string): Promise<void> {
  await issueSession(userId);
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Returns the current user, creating a guest account + cookie when absent. */
export async function ensureUser(): Promise<{ id: string; isGuest: boolean; email: string | null; name: string | null }> {
  const existingId = await getSessionUserId();
  if (existingId) {
    const user = await db.user.findUnique({ where: { id: existingId } });
    if (user) return { id: user.id, isGuest: user.isGuest, email: user.email, name: user.name };
  }
  const user = await db.user.create({ data: { isGuest: true } });
  await setSessionCookie(user.id);
  return { id: user.id, isGuest: true, email: null, name: null };
}

/** 401 the client turns into the "sign in to continue" popup. */
export function signInRequired(reason: 'ai' | 'journal' | 'matching' | 'charts') {
  return NextResponse.json({ error: 'signin_required', reason }, { status: 401 });
}

/**
 * Guest guard for member-only features (Acharya AI, journal writing, matching,
 * extra charts). Returns a ready 401 response for guests / anonymous callers,
 * or null when the caller is a signed-in member. Never creates a user row.
 */
export async function memberGuard(reason: 'ai' | 'journal' | 'matching' | 'charts') {
  const id = await getSessionUserId();
  const user = id ? await db.user.findUnique({ where: { id }, select: { isGuest: true } }) : null;
  return !user || user.isGuest ? signInRequired(reason) : null;
}

/** Guests keep exactly one chart; true when they already have one. */
export async function guestChartLimitReached(userId: string): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { isGuest: true } });
  if (!u?.isGuest) return false;
  const n = await db.birthChart.count({ where: { userId, NOT: { chartData: 'null' } } });
  return n >= 1;
}

export function newId(): string {
  return randomUUID();
}
