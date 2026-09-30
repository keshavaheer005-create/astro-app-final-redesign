import { NextResponse } from 'next/server';
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { ensureUser, setSessionCookie, clearSessionCookie, getSessionUserId } from '@/lib/session';

export const runtime = 'nodejs';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** GET /api/auth — current session user */
export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ user: null });
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ user: null });
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, isGuest: user.isGuest },
    });
  } catch (e) {
    console.error('[auth GET]', e);
    return NextResponse.json({ user: null });
  }
}

/** POST /api/auth — { action: 'guest'|'login'|'signup'|'logout'|'saveProfile', ... } */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action ?? '');

    if (action === 'guest') {
      const user = await ensureUser();
      return NextResponse.json({ user });
    }

    if (action === 'logout') {
      await clearSessionCookie();
      return NextResponse.json({ ok: true });
    }

    if (action === 'signup' || action === 'login') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (!email || password.length < 6) {
        return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
      }
      if (action === 'signup') {
        const existing = await db.user.findUnique({ where: { email } });
        if (existing) return NextResponse.json({ error: 'email_taken' }, { status: 409 });

        // If current visitor is a guest, upgrade that account (keeps charts/journal)
        const currentId = await getSessionUserId();
        if (currentId) {
          const current = await db.user.findUnique({ where: { id: currentId } });
          if (current?.isGuest) {
            const updated = await db.user.update({
              where: { id: currentId },
              data: { email, passwordHash: hashPassword(password), isGuest: false, name: body.name ? String(body.name) : current.name },
            });
            return NextResponse.json({ user: { id: updated.id, email: updated.email, isGuest: false } });
          }
        }
        const user = await db.user.create({
          data: { email, passwordHash: hashPassword(password), isGuest: false, name: body.name ? String(body.name) : null },
        });
        await setSessionCookie(user.id);
        return NextResponse.json({ user: { id: user.id, email: user.email, isGuest: false } });
      }

      // login
      const user = await db.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
      }
      await setSessionCookie(user.id);
      return NextResponse.json({ user: { id: user.id, email: user.email, isGuest: false } });
    }

    if (action === 'saveProfile') {
      const user = await ensureUser();
      const data: { name?: string } = {};
      if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
      const updated = await db.user.update({ where: { id: user.id }, data });
      return NextResponse.json({ user: { id: updated.id, name: updated.name, email: updated.email, isGuest: updated.isGuest } });
    }

    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  } catch (e) {
    console.error('[auth POST]', e);
    return NextResponse.json({ error: 'auth_failed' }, { status: 500 });
  }
}
