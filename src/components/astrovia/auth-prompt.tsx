'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AuthCard } from './auth-card';
import { useSession } from './session-context';

/**
 * "Sign in to continue" popup for GUEST users.
 *
 * Guests may build their one chart and read the Kundli. Member-only actions
 * (writing the journal, matching charts, Acharya AI, adding more charts) call
 * `requireAuth(reason, then)`:
 *   - member  → returns true, the action goes ahead;
 *   - guest   → opens this popup, returns false; once the guest signs in, the
 *               `then` callback runs so the action simply continues.
 * The server enforces the same rules (401 `signin_required`), and `api()` turns
 * that 401 into the same popup, so no path can bypass it.
 */
export type AuthPromptReason = 'journal' | 'matching' | 'ai' | 'charts' | 'generic';

interface Ctx {
  /** true → member, go ahead. false → popup opened (guest). */
  requireAuth: (reason: AuthPromptReason, then?: () => void) => boolean;
  isGuest: boolean;
}

const PromptCtx = createContext<Ctx | null>(null);

export function AuthPromptProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const isGuest = !!user?.isGuest;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<AuthPromptReason>('generic');
  const pending = useRef<(() => void) | null>(null);

  const requireAuth = useCallback(
    (r: AuthPromptReason, then?: () => void) => {
      if (!isGuest) return true;
      pending.current = then ?? null;
      setReason(r);
      setOpen(true);
      return false;
    },
    [isGuest],
  );

  // Server said 401 signin_required (e.g. a path the UI did not pre-check)
  useEffect(() => {
    const onNeed = (e: Event) => {
      const r = (e as CustomEvent<{ reason?: string }>).detail?.reason;
      setReason(r === 'journal' || r === 'matching' || r === 'ai' || r === 'charts' ? r : 'generic');
      setOpen(true);
    };
    window.addEventListener('ss:signin-required', onNeed);
    return () => window.removeEventListener('ss:signin-required', onNeed);
  }, []);

  const onAuthed = () => {
    setOpen(false);
    const fn = pending.current;
    pending.current = null;
    // let the signed-in state settle, then continue what the user was doing
    if (fn) window.setTimeout(fn, 120);
  };

  const value = useMemo(() => ({ requireAuth, isGuest }), [requireAuth, isGuest]);

  return (
    <PromptCtx.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass glass-blur max-h-[88vh] max-w-md overflow-y-auto scroll-slim border-gold/30 p-6">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="font-serif text-t20 text-charcoal">{t(`authPrompt.${reason}.title`)}</DialogTitle>
            <DialogDescription className="text-t14 leading-relaxed text-muted-foreground">
              {t(`authPrompt.${reason}.body`)}
            </DialogDescription>
          </DialogHeader>
          <AuthCard embedded hideGuest onAuthed={onAuthed} />
        </DialogContent>
      </Dialog>
    </PromptCtx.Provider>
  );
}

export function useAuthPrompt(): Ctx {
  const ctx = useContext(PromptCtx);
  // Outside the provider (e.g. the signed-out gate) nothing is gated.
  return ctx ?? { requireAuth: () => true, isGuest: false };
}
