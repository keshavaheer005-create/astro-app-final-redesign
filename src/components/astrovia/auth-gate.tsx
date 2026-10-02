'use client';

import React from 'react';
import { AuthCard } from './auth-card';
import { ChakraBackdrop, ScreenGradient } from './chakra';

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
