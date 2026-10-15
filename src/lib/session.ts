import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createHmac, randomUUID } from 'crypto';
import { db } from '@/lib/db';

const COOKIE = 'selfsage_sid';
const SECRET = process.env.SESSION_SECRET || 'selfsage-dev-secret-2024';

// Dev fallback is fine locally; scream in production builds so the operator
// sets a real SESSION_SECRET before shipping (see .env.example).
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.warn(
    '[security] SESSION_SECRET is not set — using the insecure development fallback. ' +
      'Generate one with `openssl rand -hex 32` and set it before deploying.',
  );
}

function sign(value: string): string {
  return createHmac('sha256', SECRET).update(value).digest('hex').slice(0, 32);
}

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const [id, sig] = raw.split('.');
  if (!id || !sig || sign(id) !== sig) return null;
  return id;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
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
