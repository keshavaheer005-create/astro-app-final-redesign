'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  retryBootstrap: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export { api };

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState(false);
  const [nonce, setNonce] = useState(0);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setBootstrapError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // hard 8s cap
    try {
      const me = await api<{ user: SessionUser | null }>('/api/auth', { signal: controller.signal });
      setUser(me.user);
      const charts = await api<{
        charts: { chartData: ChartData | null; isPrimary: boolean }[];
      }>('/api/charts', { signal: controller.signal });
      const primary = charts.charts.find((c) => c.isPrimary) ?? charts.charts[0];
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

  const refreshChart = useCallback(async () => {
    try {
      const charts = await api<{ charts: { chartData: ChartData | null; isPrimary: boolean }[] }>('/api/charts');
      const primary = charts.charts.find((c) => c.isPrimary) ?? charts.charts[0];
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
      retryBootstrap: () => setNonce((n) => n + 1),
    }),
    [user, chart, loading, bootstrapError, refreshChart, saveChart],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
