'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, LogoMark } from './icons';
import { GlassCard, GoldButton } from './ui-primitives';
import { ChakraWheel } from './chakra';
import { useSession } from './session-context';
import { authGateway } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/**
 * Official four-colour Google "G" — drawn inline (not an icon-library glyph)
 * because brand marks must keep their exact fills, not a 1.5px gold stroke.
 */
function GoogleG() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

const ERROR_KEYS: Record<string, string> = {
  email_taken: 'auth.errorTaken',
  invalid_credentials: 'auth.errorCredentials',
};

/**
 * Premium glass auth card — replaces the old inline AuthForm.
 * Google first, then email/password via authGateway (Supabase or local),
 * with an always-visible "continue without sign-up" escape at the bottom.
 */
export function AuthCard({ onAuthed }: { onAuthed?: () => void }) {
  const { t } = useTranslation();
  const { setUser } = useSession();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dimmed upfront when Supabase is not configured — still clickable so the
  // tap reveals the inline hint instead of a dead button.
  const [googleDimmed, setGoogleDimmed] = useState(authGateway.mode !== 'supabase');
  const [googleHint, setGoogleHint] = useState(false);

  const mapAuthError = (code?: string) => t((code && ERROR_KEYS[code]) || 'auth.errorInvalid');

  const handleGoogle = async () => {
    setGoogleHint(false);
    setError(null);
    const res = await authGateway.signInWithGoogle();
    if (res.error === 'oauth_unavailable') {
      setGoogleDimmed(true);
      setGoogleHint(true);
    } else if (res.error) {
      setError(t('auth.errorInvalid'));
    }
    // Success → the browser redirects to Google; session restores on return.
  };

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      const res =
        mode === 'signup'
          ? await authGateway.signUp(email.trim(), password, name.trim() || undefined)
          : await authGateway.signIn(email.trim(), password);
      if (res.user) {
        setUser(res.user);
        onAuthed?.();
      } else {
        setError(mapAuthError(res.error));
      }
    } catch {
      setError(t('common.networkError'));
    } finally {
      setWorking(false);
    }
  };

  const continueWithout = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await authGateway.continueAsGuest();
      if (res.user) setUser(res.user);
      onAuthed?.();
    } catch {
      setError(t('common.networkError'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <GlassCard className="relative mx-auto w-full max-w-md overflow-hidden p-7">
      {/* decorative chakra — never interactive, spins slowly behind the header */}
      <div className="pointer-events-none absolute -top-7 -right-7 text-gold opacity-[0.10]" aria-hidden="true">
        <ChakraWheel size={120} speed="slow" strokeWidth={1.5} />
      </div>

      <div className="relative flex flex-col items-center text-center">
        <LogoMark size={38} className="mb-3" />
        <h2 className="font-serif text-t20 font-semibold text-charcoal">{t('auth.cardTitle')}</h2>
        <p className="mt-1 text-t12 text-muted-foreground leading-relaxed">{t('auth.cardSubtitle')}</p>
      </div>

      {/* Google first — primary one-tap path */}
      <button
        type="button"
        onClick={handleGoogle}
        className={cn(
          'relative mt-5 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-gold/40 bg-white/70',
          'text-t14 font-semibold text-charcoal transition-all duration-250 ease-out',
          'hover:border-gold/70 hover:bg-white/90 hover:shadow-[0_4px_16px_rgba(201,162,39,0.18)]',
          'active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/25',
          googleDimmed && 'opacity-70',
        )}
      >
        <GoogleG />
        {t('auth.google')}
      </button>
      {googleHint && <p className="relative mt-2 text-t12 text-muted-foreground leading-snug">{t('auth.googleHint')}</p>}

      <div className="relative my-4 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-gold/30" />
        <span className="text-t12 uppercase tracking-wide text-muted-foreground/80">{t('auth.or')}</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/30 to-gold/30" />
      </div>

      {/* mode toggle */}
      <div className="relative grid grid-cols-2 gap-1 rounded-xl border border-gold/25 bg-white/50 p-1">
        {(['signup', 'login'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn(
              'h-9 rounded-lg text-t14 font-semibold transition-all duration-250 ease-out active:scale-[0.98]',
              mode === m
                ? 'gold-grad text-charcoal shadow-[0_2px_10px_rgba(201,162,39,0.35)]'
                : 'text-muted-foreground hover:text-charcoal',
            )}
          >
            {t(m === 'signup' ? 'auth.signup' : 'auth.login')}
          </button>
        ))}
      </div>

      <div className="relative mt-4 space-y-2.5">
        {mode === 'signup' && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('auth.name')}
            autoComplete="name"
            maxLength={40}
            className="w-full h-11 rounded-xl border border-gold/30 bg-white/70 px-3.5 text-t14 text-charcoal placeholder:text-muted-foreground/60 outline-none transition-all duration-250 focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.email')}
          autoComplete="email"
          className="w-full h-11 rounded-xl border border-gold/30 bg-white/70 px-3.5 text-t14 text-charcoal placeholder:text-muted-foreground/60 outline-none transition-all duration-250 focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.password')}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className="w-full h-11 rounded-xl border border-gold/30 bg-white/70 px-3.5 text-t14 text-charcoal placeholder:text-muted-foreground/60 outline-none transition-all duration-250 focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
        />

        {error && <p className="text-t12 text-maroon">{error}</p>}

        <GoldButton
          className="w-full"
          onClick={submit}
          disabled={working || !email.trim() || password.length < 6}
        >
          {working ? t('auth.working') : mode === 'signup' ? t('auth.signup') : t('auth.login')}
        </GoldButton>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === 'signup' ? 'login' : 'signup'));
            setError(null);
          }}
          className="block w-full text-center text-t12 text-gold hover:text-gold-light hover:underline transition-colors duration-200"
        >
          {mode === 'signup' ? t('auth.switchToLogin') : t('auth.switchToSignup')}
        </button>
      </div>

      {/* guest escape — always visible, never trapped */}
      <div className="relative mt-5 border-t border-gold/15 pt-4 text-center">
        <button
          type="button"
          onClick={continueWithout}
          disabled={working}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-t14 font-medium text-gold transition-colors duration-200 hover:text-gold-light hover:bg-gold-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/25 disabled:opacity-45 disabled:pointer-events-none"
        >
          <Icon name="user" size={14} />
          {t('auth.continueWithout')}
        </button>
        <p className="mt-1 text-t12 text-muted-foreground">{t('auth.continueWithoutHint')}</p>
      </div>
    </GlassCard>
  );
}
