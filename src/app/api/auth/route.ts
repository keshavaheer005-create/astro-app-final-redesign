import { NextResponse } from 'next/server';
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { ensureUser, setSessionCookie, clearSessionCookie, getSessionUserId } from '@/lib/session';
import { supabaseConfiguredOnServer, verifySupabaseAccessToken } from '@/lib/supabase/server';
import { getActiveChart } from '@/lib/active-chart';

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
export async function GET(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ user: null });
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ user: null });
    const body: Record<string, unknown> = {
      user: { id: user.id, name: user.name, email: user.email, isGuest: user.isGuest },
    };
    // ?chart=1 → also return the ACTIVE chart, so app start needs ONE request instead of two.
    if (new URL(req.url).searchParams.get('chart') === '1') {
      const active = await getActiveChart(user.id);
      let chart: unknown = null;
      if (active) {
        try {
          chart = JSON.parse(active.chartData);
        } catch {
          chart = null;
        }
      }
      body.chart = chart;
    }
    return NextResponse.json(body);
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

    // ── Supabase bridge ─────────────────────────────────────────────────
    // Browser signed in with Supabase (Google, or email + OTP code) and hands
    // us its access token once. We verify it with Supabase, map it to our own
    // user row and set the signed session cookie used by every other route.
    if (action === 'supabase') {
      const sb = await verifySupabaseAccessToken(String(body.accessToken ?? ''));
      if (!sb) return NextResponse.json({ error: 'invalid_token' }, { status: 401 });

      const currentId = await getSessionUserId();
      const guest = currentId ? await db.user.findUnique({ where: { id: currentId } }) : null;

      let user = await db.user.findUnique({ where: { authId: sb.id } });
      if (!user && sb.email) {
        // An older account with the same VERIFIED email → link it. Any password
        // set through the old unverified local flow is dropped, so nobody can
        // keep a back door into an account they never proved they own.
        const byEmail = await db.user.findUnique({ where: { email: sb.email } });
        if (byEmail) {
          user = await db.user.update({
            where: { id: byEmail.id },
            data: { authId: sb.id, passwordHash: null, isGuest: false, name: byEmail.name ?? sb.name },
          });
        }
      }
      if (!user && guest?.isGuest) {
        // Upgrade the current guest in place — keeps their charts and journal.
        user = await db.user.update({
          where: { id: guest.id },
          data: { authId: sb.id, email: sb.email, isGuest: false, name: guest.name ?? sb.name },
        });
      }
      if (!user) {
        user = await db.user.create({
          data: { authId: sb.id, email: sb.email, isGuest: false, name: sb.name },
        });
      } else if (guest?.isGuest && guest.id !== user.id) {
        // Signing in to an existing account from a guest session: carry the
        // guest's data over, but only into an account that has no chart yet
        // (so two journals can never collide).
        const hasCharts = await db.birthChart.count({ where: { userId: user.id } });
        if (hasCharts === 0) {
          const target = user.id;
          await db.$transaction([
            db.birthChart.updateMany({ where: { userId: guest.id }, data: { userId: target } }),
            db.chatMessage.updateMany({ where: { userId: guest.id }, data: { userId: target } }),
            db.dailyCheckIn.updateMany({ where: { userId: guest.id }, data: { userId: target } }),
            db.weeklyReflection.updateMany({ where: { userId: guest.id }, data: { userId: target } }),
            db.decisionCheck.updateMany({ where: { userId: guest.id }, data: { userId: target } }),
            db.user.delete({ where: { id: guest.id } }),
          ]);
        }
      }
      await setSessionCookie(user.id);
      return NextResponse.json({
        user: { id: user.id, name: user.name, email: user.email, isGuest: false },
      });
    }

    // With Supabase as the auth provider, the old local email+password
    // endpoints are closed: they skip the email-code verification.
    if ((action === 'signup' || action === 'login') && supabaseConfiguredOnServer) {
      return NextResponse.json({ error: 'use_supabase' }, { status: 400 });
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
