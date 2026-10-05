// Server-only module: import it from API routes only (never from client components).

/**
 * Server-side Supabase helpers (runs on Render, never in the browser).
 *
 * The app keeps its own signed httpOnly session cookie for every API route.
 * After the browser signs in with Supabase (Google, or email + OTP code) it
 * hands us the Supabase access token ONCE; we ask Supabase itself whether
 * that token is valid and whose it is. Asking Supabase works for both the
 * legacy HS256 and the newer asymmetric JWT signing keys, needs no extra
 * secrets (only the public URL + anon key) and also respects revoked sessions.
 */

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfiguredOnServer = Boolean(SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY);

export interface VerifiedSupabaseUser {
  id: string;
  email: string | null;
  name: string | null;
  provider: string;
}

/** Returns the verified Supabase user for an access token, or null. */
export async function verifySupabaseAccessToken(accessToken: string): Promise<VerifiedSupabaseUser | null> {
  if (!supabaseConfiguredOnServer || !accessToken || accessToken.length > 4096) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const u = (await res.json()) as {
      id?: string;
      email?: string | null;
      email_confirmed_at?: string | null;
      confirmed_at?: string | null;
      app_metadata?: { provider?: string };
      user_metadata?: { full_name?: string; name?: string };
    };
    if (!u.id) return null;
    // Only verified emails get an account: email+OTP users have confirmed by
    // typing the code; Google users arrive already confirmed.
    if (!u.email_confirmed_at && !u.confirmed_at) return null;
    const meta = u.user_metadata ?? {};
    return {
      id: u.id,
      email: u.email ? u.email.toLowerCase() : null,
      name: (meta.full_name ?? meta.name ?? null) || null,
      provider: u.app_metadata?.provider ?? 'email',
    };
  } catch (e) {
    console.error('[supabase verify]', (e as Error).message);
    return null;
  }
}
