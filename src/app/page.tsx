'use client';

import React, { Component, useEffect, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { SessionProvider, useSession } from '@/components/astrovia/session-context';
import { AppShellInner, type TabId } from '@/components/astrovia/app-shell';
import { OnboardingScreen } from '@/components/astrovia/screens/onboarding';
import { AuthGate, BridgeBanner } from '@/components/astrovia/auth-gate';
import { AuthPromptProvider } from '@/components/astrovia/auth-prompt';
import { HomeScreen } from '@/components/astrovia/screens/home';
import type { KundliView } from '@/components/astrovia/screens/kundli-tab';
import { LogoMark } from '@/components/astrovia/icons';
import { GoldButton, PageLoader } from '@/components/astrovia/ui-primitives';

/* ── Screens other than Home load on demand ─────────────────────────────────
   Acharya (with its Markdown reader), Journal, Kundli and Profile are not
   needed to paint the first screen, so they are separate downloads. They are
   fetched quietly once the app is idle (see AppInner), so tapping a tab is
   still instant — the first screen just opens much sooner. */
const loadKundli = () => import('@/components/astrovia/screens/kundli-tab').then((m) => m.KundliTab);
const loadJournal = () => import('@/components/astrovia/screens/journal').then((m) => m.JournalScreen);
const loadAcharya = () => import('@/components/astrovia/screens/acharya').then((m) => m.AcharyaScreen);
const loadProfile = () => import('@/components/astrovia/screens/profile').then((m) => m.ProfileScreen);
const KundliTab = dynamic(loadKundli, { ssr: false, loading: () => <PageLoader /> });
const JournalScreen = dynamic(loadJournal, { ssr: false, loading: () => <PageLoader /> });
const AcharyaScreen = dynamic(loadAcharya, { ssr: false, loading: () => <PageLoader /> });
const ProfileScreen = dynamic(loadProfile, { ssr: false, loading: () => <PageLoader /> });

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
        <div className="min-h-dvh bg-cream flex items-center justify-center px-6">
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

/* ── Static splash (language-neutral) ───────────────────────────────────── */

/**
 * Rendered during SSR and the first client render ONLY. Contains no i18n text
 * and no time-dependent output, so server HTML always matches the client tree.
 * (i18next is initialized at module scope with the persisted language, so any
 * translated string rendered pre-mount would differ from the server's 'en'
 * default and trip a hydration mismatch — e.g. the splash motto.)
 */
function StaticSplash() {
  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center px-6 relative">
      <LogoMark size={88} className="animate-pulse" />
      <h1 className="mt-5 font-serif text-t28 font-bold text-charcoal">Astrovia</h1>
      <div className="mt-8 flex gap-1.5" aria-label="loading">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-2 h-2 rounded-full bg-gold animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

/* ── Splash with hard timeout ───────────────────────────────────────────── */

function Splash({ timedOut, onRetry }: { timedOut?: boolean; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center px-6 relative">
      <LogoMark size={88} className="animate-pulse" />
      <h1 className="mt-5 font-serif text-t28 font-bold text-charcoal">Astrovia</h1>
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

const subscribeNoop = () => () => undefined;

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

  // Global navigation events (e.g. the reminder toast's "Check in now" action)
  useEffect(() => {
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: TabId; view?: string }>).detail ?? {};
      if (detail.view === 'decision') {
        setRoute({ tab: 'journal', decisionOpen: true });
      } else {
        setRoute({ tab: detail.tab ?? 'home', kundliView: detail.view as KundliView | undefined });
      }
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('ss:navigate', onNav);
    return () => window.removeEventListener('ss:navigate', onNav);
  }, []);

  // Warm up the other screens while the phone is idle (after Home has painted).
  useEffect(() => {
    if (!user || !chart) return;
    const warm = () => {
      void loadKundli();
      void loadJournal();
      void loadAcharya();
      void loadProfile();
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(warm, { timeout: 5000 }) : window.setTimeout(warm, 3000);
    return () => {
      if (!w.requestIdleCallback) window.clearTimeout(id);
    };
  }, [user, chart]);

  if (loading && (slowTimer || bootstrapError)) {
    return <Splash timedOut onRetry={retryBootstrap} />;
  }
  if (loading) {
    return <Splash />;
  }

  // Not signed in → sign up / sign in first (Google or email + emailed code)
  if (!user) {
    return (
      <>
        <BridgeBanner />
        <AuthGate />
      </>
    );
  }

  // Signed in, no chart yet → onboarding
  if (!chart) {
    return (
      <>
        <BridgeBanner />
        <OnboardingScreen />
      </>
    );
  }

  // Everything that depends on the ACTIVE chart (journal, Acharya chat,
  // letters, decisions) remounts when the active chart changes, so each chart
  // shows only its own data.
  const input = (chart as { input?: { dob?: string; tob?: string; lat?: number; lng?: number } }).input;
  const chartKey = `${input?.dob ?? ''}|${input?.tob ?? ''}|${input?.lat ?? ''}|${input?.lng ?? ''}`;

  const navigate = (tab: TabId, view?: string) => {
    // "decision" is not a Kundli view — it is the Decision Timing tool that lives
    // in the Journal tab; open it directly instead of landing on the chart.
    if (view === 'decision') {
      setRoute({ tab: 'journal', decisionOpen: true });
    } else {
      setRoute({ tab, kundliView: view as KundliView | undefined });
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const labelOf = (key: string) => t(key);

  return (
    <AppShellInner activeTab={route.tab} onTabChange={(tab) => setRoute({ tab })} labelOf={labelOf}>
      <BridgeBanner />
      <React.Fragment key={chartKey}>
      {route.tab === 'home' && <HomeScreen onNavigate={navigate} />}
      {route.tab === 'kundli' && <KundliTab key={route.kundliView ?? 'chart'} initialView={route.kundliView} />}
      {route.tab === 'journal' && (
        <JournalScreen
          key={route.decisionOpen ? 'journal-decision' : 'journal'}
          initialDecisionOpen={route.decisionOpen}
          onNavigate={navigate}
        />
      )}
      {route.tab === 'acharya' && <AcharyaScreen />}
      {route.tab === 'profile' && <ProfileScreen onChartUpdated={() => undefined} />}
      </React.Fragment>
      {/* user/chart loaded flag for potential future gating */}
      <span className="hidden">{user ? '' : ''}</span>
    </AppShellInner>
  );
}

export default function Page() {
  // Gate the i18n-aware tree behind hydration: while hydrating (and on the
  // server) we show the language-neutral StaticSplash, so hydration always
  // matches. Once hydrated, the full app renders with the persisted language.
  // useSyncExternalStore gives us a lint-clean isHydrated (server snapshot
  // false during hydration, client snapshot true after).
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  return (
    <TopErrorBoundary>
      {mounted ? (
        <SessionProvider>
          <AuthPromptProvider>
            <AppInner />
          </AuthPromptProvider>
        </SessionProvider>
      ) : (
        <StaticSplash />
      )}
    </TopErrorBoundary>
  );
}
