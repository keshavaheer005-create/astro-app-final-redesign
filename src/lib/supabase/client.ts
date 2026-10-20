'use client';

/**
 * Supabase auth adapter — the single integration point between the UI and
 * Supabase Auth (Google + email/password with an emailed one-time code).
 *
 * The flow, end to end:
 *   1. The browser (or the Capacitor WebView) talks to Supabase directly with
 *      the PUBLIC anon key — sign up, sign in, Google, verify the emailed code.
 *   2. Once Supabase has a session, `bridgeToServer()` sends its access token
 *      to OUR server (`POST /api/auth {action:'supabase'}`) exactly once. The
 *      server verifies the token with Supabase, maps it to our user row and
 *      sets the signed httpOnly session cookie that every API route uses.
 *   3. Sign-out clears both the Supabase session and our cookie.
 *
 * When the Supabase env vars are absent (local sandbox) everything falls back
 * to the built-in /api/auth email+password endpoints so nothing breaks.
 */

import type { SessionUser } from '@/components/astrovia/session-context';
import { apiUrl } from '@/lib/api';
import { createClient, type AuthError, type SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export type AuthMode = 'supabase' | 'local';
export const authMode: AuthMode = isSupabaseConfigured ? 'supabase' : 'local';

/** Deep link the Android app registers (see AndroidManifest.xml) for the Google round-trip. */
export const NATIVE_AUTH_REDIRECT = 'com.astrovia.app://auth-callback';

const isNative = () => typeof window !== 'undefined' && Capacitor.isNativePlatform();

let browserClient: SupabaseClient | null = null;

/** Lazy singleton Supabase browser client (null when not configured). */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
        // In the native app the code arrives through the deep-link listener
        // below, not through the WebView URL.
        detectSessionInUrl: !isNative(),
      },
    });
  }
  return browserClient;
}

export interface AuthResult {
  user?: SessionUser;
  /** An emailed code is required next (sign-up confirmation). */
  needsOtp?: boolean;
  /** Google opened in the system browser; the result arrives via deep link. */
  pending?: boolean;
  error?: string; // machine code, mapped to text in auth-card
}

function mapError(e: Pick<AuthError, 'code' | 'message' | 'status'>): string {
  const code = e.code ?? '';
  const msg = (e.message ?? '').toLowerCase();
  if (code === 'user_already_exists' || msg.includes('already registered')) return 'email_taken';
  if (code === 'email_not_confirmed') return 'email_not_confirmed';
  if (code === 'invalid_credentials') return 'invalid_credentials';
  if (code === 'weak_password') return 'weak_password';
  if (code === 'otp_expired' || msg.includes('expired')) return 'otp_invalid';
  if (e.status === 429 || code.includes('rate_limit')) return 'rate_limited';
  return 'invalid_input';
}

/* ── Bridge: Supabase session → our server cookie ───────────────────────── */

async function postAuth(body: Record<string, unknown>) {
  const res = await fetch(apiUrl('/api/auth'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { user?: SessionUser; error?: string };
  return { ok: res.ok, json };
}

/** Sends the current Supabase access token to our server; returns the app user. */
async function bridgeToServer(): Promise<SessionUser | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return null;
  const { ok, json } = await postAuth({ action: 'supabase', accessToken });
  return ok && json.user ? json.user : null;
}

/* ── Supabase implementations ───────────────────────────────────────────── */

async function sbSignUp(email: string, password: string, name?: string): Promise<AuthResult> {
  const sb = getSupabaseClient();
  if (!sb) return { error: 'oauth_unavailable' };
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: name ? { data: { full_name: name } } : undefined,
  });
  if (error) return { error: mapError(error) };
  // Supabase hides whether an address is registered: an existing, confirmed
  // address comes back as a user with NO identities (and no email is sent).
  if (data.user && (data.user.identities?.length ?? 1) === 0) return { error: 'email_taken' };
  if (data.session) {
    // "Confirm email" is switched off in the dashboard → already signed in.
    const user = await bridgeToServer();
    return user ? { user } : { error: 'bridge_failed' };
  }
  return { needsOtp: true };
}

async function sbSignIn(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabaseClient();
  if (!sb) return { error: 'oauth_unavailable' };
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === 'email_not_confirmed') {
      // Signed up earlier but never entered the code → send a fresh one.
      await sb.auth.resend({ type: 'signup', email });
      return { needsOtp: true };
    }
    return { error: mapError(error) };
  }
  const user = await bridgeToServer();
  return user ? { user } : { error: 'bridge_failed' };
}

async function sbVerifyOtp(email: string, token: string): Promise<AuthResult> {
  const sb = getSupabaseClient();
  if (!sb) return { error: 'oauth_unavailable' };
  const { error } = await sb.auth.verifyOtp({ email, token: token.trim(), type: 'signup' });
  if (error) return { error: mapError(error) === 'rate_limited' ? 'rate_limited' : 'otp_invalid' };
  const user = await bridgeToServer();
  return user ? { user } : { error: 'bridge_failed' };
}

async function sbResendOtp(email: string): Promise<AuthResult> {
  const sb = getSupabaseClient();
  if (!sb) return { error: 'oauth_unavailable' };
  const { error } = await sb.auth.resend({ type: 'signup', email });
  return error ? { error: mapError(error) } : {};
}

async function sbForgotPassword(email: string): Promise<AuthResult> {
  const sb = getSupabaseClient();
  if (!sb) return { error: 'oauth_unavailable' };
  const { error } = await sb.auth.resetPasswordForEmail(email);
  // Never reveal whether the address exists — only surface rate limits.
  return error && mapError(error) === 'rate_limited' ? { error: 'rate_limited' } : {};
}

async function sbResetPassword(email: string, token: string, newPassword: string): Promise<AuthResult> {
  const sb = getSupabaseClient();
  if (!sb) return { error: 'oauth_unavailable' };
  const verified = await sb.auth.verifyOtp({ email, token: token.trim(), type: 'recovery' });
  if (verified.error) return { error: 'otp_invalid' };
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) return { error: mapError(error) === 'invalid_input' ? 'weak_password' : mapError(error) };
  const user = await bridgeToServer();
  return user ? { user } : { error: 'bridge_failed' };
}

async function sbSignInWithGoogle(): Promise<AuthResult> {
  const sb = getSupabaseClient();
  if (!sb) return { error: 'oauth_unavailable' };

  if (isNative()) {
    // Google refuses to sign in inside an embedded WebView, so open the
    // system browser (Chrome Custom Tab) and come back through the deep link.
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: NATIVE_AUTH_REDIRECT,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error || !data.url) return { error: 'oauth_failed' };
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: data.url });
    return { pending: true };
  }

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/`, queryParams: { prompt: 'select_account' } },
  });
  if (error) return { error: 'oauth_failed' };
  return { pending: true }; // the browser navigates to Google; the session is restored on return
}

let nativeListenerAttached = false;

/**
 * Android only: finishes the Google sign-in when Android hands the
 * `com.astrovia.app://auth-callback?code=…` deep link back to the app.
 */
export async function attachNativeAuthListener(onUser: (u: SessionUser) => void): Promise<void> {
  if (!isNative() || nativeListenerAttached || !isSupabaseConfigured) return;
  nativeListenerAttached = true;
  const { App } = await import('@capacitor/app');
  await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return;
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.close(); // no-op on Android Custom Tabs; harmless
    } catch {
      /* ignore */
    }
    const sb = getSupabaseClient();
    const code = new URL(url).searchParams.get('code');
    if (!sb || !code) return;
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return;
    const user = await bridgeToServer();
    if (user) onUser(user);
  });
}

/* ── Unified facade (local fallbacks hit /api/auth) ─────────────────────── */

async function localAuth(body: Record<string, unknown>): Promise<AuthResult> {
  const { ok, json } = await postAuth(body);
  if (!ok) return { error: json.error ?? 'invalid_input' };
  return { user: json.user };
}

const NEEDS_SUPABASE: AuthResult = { error: 'oauth_unavailable' };

export const authGateway = {
  mode: authMode,
  signUp: (email: string, password: string, name?: string) =>
    authMode === 'supabase' ? sbSignUp(email, password, name) : localAuth({ action: 'signup', email, password, name }),
  signIn: (email: string, password: string) =>
    authMode === 'supabase' ? sbSignIn(email, password) : localAuth({ action: 'login', email, password }),
  verifyOtp: (email: string, token: string) => (authMode === 'supabase' ? sbVerifyOtp(email, token) : Promise.resolve(NEEDS_SUPABASE)),
  resendOtp: (email: string) => (authMode === 'supabase' ? sbResendOtp(email) : Promise.resolve(NEEDS_SUPABASE)),
  forgotPassword: (email: string) => (authMode === 'supabase' ? sbForgotPassword(email) : Promise.resolve(NEEDS_SUPABASE)),
  resetPassword: (email: string, token: string, pw: string) =>
    authMode === 'supabase' ? sbResetPassword(email, token, pw) : Promise.resolve(NEEDS_SUPABASE),
  signInWithGoogle: () => (authMode === 'supabase' ? sbSignInWithGoogle() : Promise.resolve(NEEDS_SUPABASE)),
  /** Clears the Supabase session AND our server cookie. */
  signOut: async () => {
    const sb = getSupabaseClient();
    if (sb) await sb.auth.signOut().catch(() => undefined);
    await postAuth({ action: 'logout' });
  },
  /** Guest sessions stay available as the "continue without sign-up" escape. */
  continueAsGuest: () => localAuth({ action: 'guest' }),
  /**
   * On app start: if Supabase still holds a session (e.g. right after the web
   * Google redirect, or our cookie expired) turn it into our server cookie.
   * `failed` = a Supabase session exists but our server would not accept it.
   */
  restoreServerSession: async (): Promise<{ user: SessionUser | null; failed: boolean }> => {
    if (authMode !== 'supabase') return { user: null, failed: false };
    const sb = getSupabaseClient();
    if (!sb) return { user: null, failed: false };
    const { data } = await sb.auth.getSession();
    if (!data.session) return { user: null, failed: false };
    const user = await bridgeToServer();
    return { user, failed: !user };
  },
};
