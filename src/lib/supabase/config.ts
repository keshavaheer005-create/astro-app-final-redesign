/**
 * Supabase configuration — reads ONLY from environment variables, never hardcoded.
 *
 * Required env vars (see .env.example):
 *   NEXT_PUBLIC_SUPABASE_URL      e.g. https://xxxxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY e.g. eyJhbGciOi...
 *
 * Google OAuth is enabled through the Supabase dashboard
 * (Authentication → Providers → Google), where the Google client ID/secret live.
 * No Google credentials are needed in this codebase — once the two env vars
 * above are set, the Google button activates automatically.
 *
 * When the env vars are absent (e.g. local sandbox), the app transparently
 * falls back to the built-in /api/auth email+password system with first-class
 * guest sessions. Nothing breaks; you just update env vars when ready.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True only when both Supabase env vars are present. */
export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('http'),
);

/** Where Supabase should return users after the Google OAuth round-trip. */
export function getOAuthRedirectUrl(): string {
  if (typeof window !== 'undefined') return `${window.location.origin}/`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000/';
}
