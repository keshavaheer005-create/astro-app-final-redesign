'use client';

/**
 * Supabase auth adapter — the single integration point for swapping the
 * built-in auth system for Supabase. The UI talks to EITHER this module
 * (when Supabase env vars are set) OR the local /api/auth endpoints
 * (default in the sandbox), chosen by `authMode` / `isSupabaseConfigured`.
 *
 * Everything returns the app's SessionUser shape so no screen code changes
 * when you add real credentials later.
 */

import type { SessionUser } from '@/components/selfsage/session-context';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getOAuthRedirectUrl, isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export type AuthMode = 'supabase' | 'local';
export const authMode: AuthMode = isSupabaseConfigured ? 'supabase' : 'local';

let browserClient: SupabaseClient | null = null;

/** Lazy singleton Supabase browser client (null when not configured). */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return browserClient;
}

function toSessionUser(u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): SessionUser {
  const meta = u.user_metadata ?? {};
  return {
    id: u.id,
    name: typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : null,
    email: u.email ?? null,
    isGuest: false,
  };
}

export interface AuthResult {
  user?: SessionUser;
  error?: string; // machine code: 'invalid_credentials' | 'email_taken' | 'oauth_unavailable' | ...
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
  if (error) return { error: error.message.includes('already') ? 'email_taken' : 'invalid_input' };
  return { user: data.user ? toSessionUser(data.user) : undefined };
}

async function sbSignIn(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabaseClient();
  if (!sb) return { error: 'oauth_unavailable' };
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: 'invalid_credentials' };
  return { user: data.user ? toSessionUser(data.user) : undefined };
}

async function sbSignInWithGoogle(): Promise<AuthResult> {
  const sb = getSupabaseClient();
  if (!sb) return { error: 'oauth_unavailable' };
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getOAuthRedirectUrl() },
  });
  if (error) return { error: 'oauth_failed' };
  return {}; // browser redirects to Google; session is restored on return
}

async function sbSignOut(): Promise<void> {
  const sb = getSupabaseClient();
  if (sb) await sb.auth.signOut();
}

/** Restore the Supabase session (call once on mount when mode = supabase). */
export async function sbGetSessionUser(): Promise<SessionUser | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const u = data.session?.user;
  return u ? toSessionUser(u) : null;
}

/* ── Unified facade (local fallbacks hit /api/auth) ─────────────────────── */

async function localAuth(body: Record<string, unknown>): Promise<AuthResult> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { user?: SessionUser; error?: string };
  if (!res.ok) return { error: json.error ?? 'invalid_input' };
  return { user: json.user };
}

export const authGateway = {
  mode: authMode,
  signUp: (email: string, password: string, name?: string) =>
    authMode === 'supabase' ? sbSignUp(email, password, name) : localAuth({ action: 'signup', email, password, name }),
  signIn: (email: string, password: string) =>
    authMode === 'supabase' ? sbSignIn(email, password) : localAuth({ action: 'login', email, password }),
  signInWithGoogle: () => (authMode === 'supabase' ? sbSignInWithGoogle() : Promise.resolve({ error: 'oauth_unavailable' })),
  signOut: () => (authMode === 'supabase' ? sbSignOut() : localAuth({ action: 'logout' })),
  /** Guest sessions exist only in local mode; Supabase mode requires a real account. */
  continueAsGuest: () => localAuth({ action: 'guest' }),
  getSessionUser: () => (authMode === 'supabase' ? sbGetSessionUser() : Promise.resolve(null)),
};
