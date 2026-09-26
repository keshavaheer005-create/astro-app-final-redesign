'use client';

import React, { Component, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionProvider, useSession } from '@/components/selfsage/session-context';
import { AppShellInner, type TabId } from '@/components/selfsage/app-shell';
import { OnboardingScreen } from '@/components/selfsage/screens/onboarding';
import { HomeScreen } from '@/components/selfsage/screens/home';
import { KundliTab, type KundliView } from '@/components/selfsage/screens/kundli-tab';
import { JournalScreen } from '@/components/selfsage/screens/journal';
import { AcharyaScreen } from '@/components/selfsage/screens/acharya';
import { ProfileScreen } from '@/components/selfsage/screens/profile';
import { LogoMark } from '@/components/selfsage/icons';
import { GoldButton } from '@/components/selfsage/ui-primitives';

/* ── Error boundary (top-level) ─────────────────────────────────────────── */

class TopErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[boundary]', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-cream flex items-center justify-center px-6">
          <div className="glass p-8 max-w-md text-center">
            <LogoMark size={56} className="mx-auto mb-4 opacity-70" />
            <h1 className="font-serif text-t20 font-bold text-charcoal">The stars slipped</h1>
            <p className="mt-2 text-t14 text-muted-foreground">{String(this.state.error.message || 'Unexpected error')}</p>
            <button
              type="button"
              onClick={() => location.reload()}
              className="mt-5 gold-grad rounded-full px-6 h-10 text-t14 font-semibold text-charcoal"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Splash with hard timeout ───────────────────────────────────────────── */

function Splash({ timedOut, onRetry }: { timedOut?: boolean; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 relative">
      <div className="mandala-bg" aria-hidden="true" />
      <LogoMark size={88} className="animate-pulse" />
      <h1 className="mt-5 font-serif text-t28 font-bold text-charcoal">Self Sage</h1>
      <p className="mt-1.5 text-gold-grad font-serif text-t14 italic">{t('splash.motto')}</p>
      {timedOut ? (
        <div className="mt-8 text-center">
          <p className="text-t14 text-muted-foreground">{t('splash.timeout')}</p>
          <div className="mt-4">
            <GoldButton onClick={onRetry}>{t('common.retry')}</GoldButton>
          </div>
        </div>
      ) : (
        <div className="mt-8 flex gap-1.5" aria-label="loading">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-gold animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── App root ───────────────────────────────────────────────────────────── */

type Route = { tab: TabId; kundliView?: KundliView; decisionOpen?: boolean };

function AppInner() {
  const { t } = useTranslation();
  const { user, chart, loading, bootstrapError, retryBootstrap } = useSession();
  const [route, setRoute] = useState<Route>({ tab: 'home' });
  const [slowTimer, setSlowTimer] = useState(false);

  // Hard 8s timeout on bootstrap
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlowTimer(true), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && (slowTimer || bootstrapError)) {
    return <Splash timedOut onRetry={retryBootstrap} />;
  }
  if (loading) {
    return <Splash />;
  }

  // Fresh visitor without a chart → onboarding
  if (!chart) {
    return <OnboardingScreen />;
  }

  const navigate = (tab: TabId, view?: string) => {
    setRoute({ tab, kundliView: view as KundliView | undefined });
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const labelOf = (key: string) => t(key);

  return (
    <AppShellInner activeTab={route.tab} onTabChange={(tab) => setRoute({ tab })} labelOf={labelOf}>
      {route.tab === 'home' && <HomeScreen onNavigate={navigate} />}
      {route.tab === 'kundli' && <KundliTab key={route.kundliView ?? 'chart'} initialView={route.kundliView} />}
      {route.tab === 'journal' && <JournalScreen />}
      {route.tab === 'acharya' && <AcharyaScreen />}
      {route.tab === 'profile' && <ProfileScreen onChartUpdated={() => undefined} />}
      {/* user/chart loaded flag for potential future gating */}
      <span className="hidden">{user ? '' : ''}</span>
    </AppShellInner>
  );
}

export default function Page() {
  return (
    <TopErrorBoundary>
      <SessionProvider>
        <AppInner />
      </SessionProvider>
    </TopErrorBoundary>
  );
}
