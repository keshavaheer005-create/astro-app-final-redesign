'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { attachNativeAuthListener, authGateway } from '@/lib/supabase/client';

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  isGuest: boolean;
}

export interface BirthDetails {
  name: string;
  dob: string;
  tob: string;
  lat: number;
  lng: number;
  timezone: string;
  placeName?: string;
}

 
export type ChartData = any; // ComputedChart JSON shape (validated server-side)

interface SessionCtx {
  user: SessionUser | null;
  chart: ChartData | null;
  setChart: (c: ChartData | null) => void;
  setUser: (u: SessionUser | null) => void;
  loading: boolean;
  refreshChart: () => Promise<void>;
  saveChart: (details: BirthDetails, chart: ChartData) => Promise<void>;
  bootstrapError: boolean;
  /** Signed in with Google/email, but the server could not accept that session. */
  bridgeFailed: boolean;
  retryBootstrap: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

// Re-exported for the many screens that import { api } from './session-context'
export { api };

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState(false);
  const [bridgeFailed, setBridgeFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setBootstrapError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // hard 8s cap
    try {
      let me = await api<{ user: SessionUser | null }>('/api/auth', { signal: controller.signal });
      if (!me.user || me.user.isGuest) {
        // No server cookie yet — OR only a guest one (e.g. "continue without
        // sign-up" earlier, or the guest cookie left from before signing in).
        // If Supabase holds a session (right after the Google redirect, or an
        // expired cookie), turn it into a real member session. A guest is
        // upgraded in place, so their chart and journal are kept.
        const restored = await authGateway.restoreServerSession();
        if (restored.user) me = { user: restored.user };
        setBridgeFailed(restored.failed);
      } else {
        setBridgeFailed(false);
      }
      setUser(me.user);
      if (!me.user) {
        // Signed out → the app shows the sign-in gate instead of creating a
        // silent guest account behind the user's back.
        setChart(null);
        return;
      }
      const charts = await api<{
        charts: { chartData: ChartData | null; isPrimary: boolean }[];
      }>('/api/charts', { signal: controller.signal });
      // Prefer the active chart, but never let a data-less primary blank the app:
      // fall back to any chart that carries a computed snapshot.
      const primary =
        charts.charts.find((c) => c.isPrimary && c.chartData) ??
        charts.charts.find((c) => c.chartData) ??
        charts.charts.find((c) => c.isPrimary) ??
        charts.charts[0];
      if (primary?.chartData) setChart(primary.chartData);
      else setChart(null);
    } catch (e) {
      if ((e as Error).name === 'AbortError') setBootstrapError(true);
      else setBootstrapError(true);
      console.error('[bootstrap]', e);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap, nonce]);

  // Android: finish the Google sign-in when the deep link returns to the app.
  useEffect(() => {
    void attachNativeAuthListener((u) => {
      setUser(u);
      setNonce((n) => n + 1);
    });
  }, []);

  const refreshChart = useCallback(async () => {
    try {
      const charts = await api<{ charts: { chartData: ChartData | null; isPrimary: boolean }[] }>('/api/charts');
      const primary =
        charts.charts.find((c) => c.isPrimary && c.chartData) ??
        charts.charts.find((c) => c.chartData) ??
        charts.charts.find((c) => c.isPrimary) ??
        charts.charts[0];
      setChart(primary?.chartData ?? null);
    } catch (e) {
      console.error('[refreshChart]', e);
    }
  }, []);

  const saveChart = useCallback(async (details: BirthDetails, chartData: ChartData) => {
    setChart(chartData);
    setUser((u) => (u ? { ...u, name: details.name } : u));
    try {
      await api('/api/charts', {
        method: 'POST',
        body: JSON.stringify({ ...details, chartData, makePrimary: true }),
      });
      await api('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'saveProfile', name: details.name }),
      });
    } catch (e) {
      console.error('[saveChart]', e);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      chart,
      setChart,
      setUser,
      loading,
      refreshChart,
      saveChart,
      bootstrapError,
      bridgeFailed,
      retryBootstrap: () => setNonce((n) => n + 1),
    }),
    [user, chart, loading, bootstrapError, bridgeFailed, refreshChart, saveChart],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
