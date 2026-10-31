'use client';

import React from 'react';
import { AuthCard } from './auth-card';
import { useTranslation } from 'react-i18next';
import { ChakraBackdrop, ScreenGradient } from './chakra';
import { useSession } from './session-context';

/**
 * First screen for anyone who is not signed in: sign up / sign in (Google or
 * email + emailed code). "Continue without sign-up" stays at the bottom.
 */
export function AuthGate({ onAuthed }: { onAuthed?: () => void }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-cream">
      <ChakraBackdrop />
      <ScreenGradient tone="gold" />
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8">
        <AuthCard onAuthed={onAuthed} />
      </div>
    </div>
  );
}

/**
 * Shown when Google/email sign-in succeeded in the browser but our server
 * could not accept it — instead of silently staying a guest.
 */
export function BridgeBanner() {
  const { t } = useTranslation();
  const { bridgeFailed, retryBootstrap } = useSession();
  if (!bridgeFailed) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-2xl bg-burgundy-soft/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_24px_-8px_rgba(42,36,32,0.25)] p-3 text-t12 text-burgundy backdrop-blur-sm"
    >
      <p className="leading-relaxed">{t('auth.bridgeFailed')}</p>
      <button type="button" onClick={retryBootstrap} className="tap-sm mt-1 font-semibold text-gold hover:underline">
        {t('common.retry')}
      </button>
    </div>
  );
}
