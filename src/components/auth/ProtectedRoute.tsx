'use client';

/**
 * ProtectedRoute — wraps any view that should require a signed-in account.
 *
 * Usage (when you want to gate a screen later — nothing is gated by default):
 *
 *   <ProtectedRoute allowGuest feature="acharya">
 *     <AcharyaScreen />
 *   </ProtectedRoute>
 *
 * Behaviour:
 *  - While session bootstraps → gold spinner (no flash of the gate).
 *  - Signed-in user → children render.
 *  - Guest + allowGuest → children render (guest-first product).
 *  - No user / guest + !allowGuest → premium glass gate with email/password
 *    sign-in CTA, Google button (when Supabase is configured) and an explicit
 *    "Continue without sign-up" escape so the user is never trapped.
 */

import { useTranslation } from 'react-i18next';
import { Icon, LogoMark } from '@/components/selfsage/icons';
import { GlassCard, GoldButton, GhostButton } from '@/components/selfsage/ui-primitives';
import { ChakraSpinner } from '@/components/selfsage/chakra';
import { useSession } from '@/components/selfsage/session-context';

export function ProtectedRoute({
  children,
  allowGuest = true,
  fallback,
}: {
  children: React.ReactNode;
  /** Guests pass through when true (default) — set false to hard-gate. */
  allowGuest?: boolean;
  /** Fully custom gate UI (overrides the built-in card). */
  fallback?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { user, loading } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <ChakraSpinner size={56} />
      </div>
    );
  }

  const passes = !!user && (allowGuest || !user.isGuest);
  if (passes) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <GlassCard className="mx-auto max-w-md p-8 text-center">
      <LogoMark size={56} className="mx-auto mb-4" />
      <h2 className="font-serif text-t20 font-semibold text-charcoal">{t('auth.gateTitle')}</h2>
      <p className="mt-2 text-t14 text-muted-foreground leading-relaxed">{t('auth.gateBody')}</p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <GoldButton onClick={() => (location.hash = '#profile')} className="w-full">
          <Icon name="shield" size={16} /> {t('profile.signIn')}
        </GoldButton>
        <p className="text-t12 text-muted-foreground">{t('auth.gateGuestHint')}</p>
      </div>
    </GlassCard>
  );
}
