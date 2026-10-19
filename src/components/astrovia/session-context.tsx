'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { attachNativeAuthListener, authGateway } from '@/lib/supabase/client';
import {
  adoptAccount,
  deleteChartSnapshot,
  readChartSnapshot,
  writeChartSnapshot,
} from '@/lib/client-cache';
import { count, end, start } from '@/lib/perf';

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

/** One saved chart row as returned by /api/charts (chartData included). */
interface ChartRow {
  id: string;
  isPrimary: boolean;
  chartData: ChartData | null;
}

interface SessionCtx {
  user: SessionUser | null;
  chart: ChartData | null;
  /** Database id of the ACTIVE saved chart (null before a chart exists). */
  activeChartId: string | null;
  /** True while the painted chart came from the device snapshot, not the server. */
  chartFromCache: boolean;
  setChart: (c: ChartData | null) => void;
  setUser: (u: SessionUser | null) => void;
  loading: boolean;
  refreshChart: () => Promise<void>;
  /**
   * Switch the active saved chart. Paints that chart's on-device snapshot
   * BEFORE the network round trip (and never the previous chart's), then
   * reconciles with the server.
   */
  activateChart: (chartId: string) => Promise<void>;
  /** Drop a deleted chart's snapshot so it can never be painted again. */
  forgetChartSnapshot: (chartId: string) => void;
  saveChart: (details: BirthDetails, chart: ChartData) => Promise<void>;
  bootstrapError: boolean;
  /** Signed in with Google/email, but the server could not accept that session. */
  bridgeFailed: boolean;
  retryBootstrap: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

// Re-exported for the many screens that import { api } from './session-context'
export { api };

/** Pick the row the app should show: active-with-data, then any-with-data, then active. */
function pickPrimary(rows: ChartRow[]): ChartRow | undefined {
  return (
    rows.find((c) => c.isPrimary && c.chartData) ??
    rows.find((c) => c.chartData) ??
    rows.find((c) => c.isPrimary) ??
    rows[0]
  );
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [activeChartId, setActiveChartId] = useState<string | null>(null);
  const [chartFromCache, setChartFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState(false);
  const [bridgeFailed, setBridgeFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Mirrors so async callbacks never act on a stale account/chart.
  const userIdRef = useRef<string | null>(null);
  const chartIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);
  useEffect(() => {
    chartIdRef.current = activeChartId;
  }, [activeChartId]);

  const resetChart = useCallback(() => {
    setChart(null);
    setActiveChartId(null);
    chartIdRef.current = null;
    setChartFromCache(false);
  }, []);

  const bootstrap = useCallback(async () => {
    const t0 = start();
    let usedCache = false;
    setLoading(true);
    setBootstrapError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // hard 8s cap
    try {
      let me = await api<{
        user: SessionUser | null;
        chart?: ChartData | null;
        chartId?: string | null;
      }>('/api/auth?chart=1', { signal: controller.signal });
      end('bootstrap.auth', t0);
      let chartFromAuth: ChartData | null | undefined = me.chart;
      let serverChartId: string | null = me.chartId ?? null;
      if (!me.user || me.user.isGuest) {
        // No server cookie yet — OR only a guest one (e.g. "continue without
        // sign-up" earlier, or the guest cookie left from before signing in).
        // If Supabase holds a session (right after the Google redirect, or an
        // expired cookie), turn it into a real member session. A guest is
        // upgraded in place, so their chart and journal are kept.
        const restored = await authGateway.restoreServerSession();
        if (restored.user) {
          me = { user: restored.user };
          chartFromAuth = undefined; // account changed → load that account's chart below
          serverChartId = null;
        }
        setBridgeFailed(restored.failed);
      } else {
        setBridgeFailed(false);
      }
      setUser(me.user);
      if (!me.user) {
        // Signed out → the app shows the sign-in gate instead of creating a
        // silent guest account behind the user's back.
        resetChart();
        return;
      }

      // ── The server has now confirmed WHO this is. Only from this point on may
      // the device cache be read. Cached data never proves authorization.
      const adopted = await adoptAccount(me.user.id);
      if (adopted.switched) count('cache.account.switched');
      const userId = me.user.id;

      const paintFromSnapshot = async (chartId: string): Promise<boolean> => {
        const cached = await readChartSnapshot(userId, chartId);
        if (!cached) return false;
        setChart(cached.chart);
        setActiveChartId(chartId);
        chartIdRef.current = chartId;
        setChartFromCache(true);
        usedCache = true;
        count('cache.chart.hit');
        return true;
      };

      if (chartFromAuth !== undefined) {
        // Chart delivered with the sign-in check — no second round trip.
        setActiveChartId(serverChartId);
        chartIdRef.current = serverChartId;
        setChart(chartFromAuth);
        setChartFromCache(false);
        if (serverChartId && chartFromAuth) {
          void writeChartSnapshot(userId, serverChartId, chartFromAuth);
        } else if (serverChartId) {
          // The row exists but its blob was unreadable: a confirmed snapshot is
          // the best available answer for THIS chart id.
          await paintFromSnapshot(serverChartId);
        }
        if (!serverChartId) {
          // No saved chart at all — the caller shows onboarding.
          setChart(null);
        }
        end('bootstrap.total', t0, { fromCache: usedCache });
        return;
      }

      // Account just switched/restored: load that account's chart list.
      const charts = await api<{ charts: ChartRow[] }>('/api/charts?active=1', { signal: controller.signal });
      const primary = pickPrimary(charts.charts);
      if (primary?.chartData) {
        setChart(primary.chartData);
        setActiveChartId(primary.id);
        chartIdRef.current = primary.id;
        setChartFromCache(false);
        void writeChartSnapshot(userId, primary.id, primary.chartData);
      } else if (primary) {
        setActiveChartId(primary.id);
        chartIdRef.current = primary.id;
        // Snapshot may hold the last computed version of this same chart.
        const painted = await paintFromSnapshot(primary.id);
        if (!painted) setChart(null);
      } else {
        resetChart();
      }
      end('bootstrap.total', t0, { fromCache: usedCache });
    } catch (e) {
      if ((e as Error).name === 'AbortError') setBootstrapError(true);
      else setBootstrapError(true);
      console.error('[bootstrap]', e);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      count('bootstrap');
    }
  }, [resetChart]);

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
      const charts = await api<{ charts: ChartRow[] }>('/api/charts?active=1');
      const primary = pickPrimary(charts.charts);
      const userId = userIdRef.current;
      if (primary?.chartData) {
        setChart(primary.chartData);
        setActiveChartId(primary.id);
        chartIdRef.current = primary.id;
        setChartFromCache(false);
        if (userId) void writeChartSnapshot(userId, primary.id, primary.chartData);
      } else if (primary) {
        setActiveChartId(primary.id);
        chartIdRef.current = primary.id;
        const cached = userId ? await readChartSnapshot(userId, primary.id) : null;
        if (cached) {
          setChart(cached.chart);
          setChartFromCache(true);
        } else {
          setChart(null);
        }
      } else {
        resetChart();
      }
    } catch (e) {
      console.error('[refreshChart]', e);
      // Keep whatever is on screen: a failed refresh must not blank the app.
    }
  }, [resetChart]);

  /**
   * Switch the active chart. The on-device snapshot of the TARGET chart is
   * painted first (so switching family profiles is instant), and the previous
   * chart is cleared in the same tick — never a frame showing the old data.
   */
  const activateChart = useCallback(
    async (chartId: string) => {
      const userId = userIdRef.current;
      if (!userId || !chartId) return;
      const cached = await readChartSnapshot(userId, chartId);
      if (cached) {
        setChart(cached.chart);
        setActiveChartId(chartId);
        chartIdRef.current = chartId;
        setChartFromCache(true);
        count('cache.chart.hit');
      } else if (chartIdRef.current !== chartId) {
        // No snapshot for the target: blank the screen rather than keep showing
        // the previous profile's chart while the request is in flight.
        setChart(null);
        setChartFromCache(false);
        setActiveChartId(chartId);
        chartIdRef.current = chartId;
      }
      try {
        await api('/api/charts', { method: 'PATCH', body: JSON.stringify({ id: chartId, makePrimary: true }) });
        await refreshChart();
      } catch (e) {
        // The switch failed on the server: re-read the truth instead of leaving
        // the UI pointing at a chart that is not actually active.
        console.error('[activateChart]', e);
        await refreshChart();
        throw e;
      }
    },
    [refreshChart],
  );

  const forgetChartSnapshot = useCallback((chartId: string) => {
    const userId = userIdRef.current;
    if (!userId || !chartId) return;
    void deleteChartSnapshot(userId, chartId);
    if (chartIdRef.current === chartId) {
      chartIdRef.current = null;
      setActiveChartId(null);
    }
  }, []);

  const saveChart = useCallback(async (details: BirthDetails, chartData: ChartData) => {
    setChart(chartData);
    setUser((u) => (u ? { ...u, name: details.name } : u));
    try {
      const saved = await api<{ chart?: { id: string } }>('/api/charts', {
        method: 'POST',
        body: JSON.stringify({ ...details, chartData, makePrimary: true }),
      });
      const userId = userIdRef.current;
      const chartId = saved?.chart?.id;
      if (userId && chartId) {
        setActiveChartId(chartId);
        chartIdRef.current = chartId;
        void writeChartSnapshot(userId, chartId, chartData);
      }
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
      activeChartId,
      chartFromCache,
      setChart,
      setUser,
      loading,
      refreshChart,
      activateChart,
      forgetChartSnapshot,
      saveChart,
      bootstrapError,
      bridgeFailed,
      retryBootstrap: () => setNonce((n) => n + 1),
    }),
    [
      user,
      chart,
      activeChartId,
      chartFromCache,
      loading,
      bootstrapError,
      bridgeFailed,
      refreshChart,
      activateChart,
      forgetChartSnapshot,
      saveChart,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
