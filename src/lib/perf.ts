/**
 * Client-side performance instrumentation (the "measure before you optimize"
 * foundation).
 *
 * Nothing here renders. It records:
 *   • timings   — named durations (`start` → `end`), e.g. bootstrap, cached
 *                 paint, tab switch commit;
 *   • counters  — e.g. API requests per route, cache hits/misses.
 *
 * Read it with any of:
 *   • `window.__astroviaPerf.snapshot()` in DevTools (always available);
 *   • the `?perf=1` / `localStorage['astrovia:perf']='1'` switch, which also
 *     prints a table on every navigation commit;
 *   • `ASTROVIA_PERF=1` in the console (any truthy value).
 *
 * The buffer is bounded so a long-lived Android WebView cannot grow it without
 * limit. Timings are intentionally NOT uploaded anywhere.
 */
export interface PerfEntry {
  name: string;
  ms: number;
  /** epoch ms when the measurement finished */
  at: number;
  meta?: Record<string, unknown>;
}

export interface PerfSnapshot {
  entries: PerfEntry[];
  counters: Record<string, number>;
  /** Web Vitals style marks captured at boot, if the browser supports it. */
  marks: { name: string; at: number }[];
}

const MAX_ENTRIES = 250;
const entries: PerfEntry[] = [];
const counters = new Map<string, number>();
const bootMarks: { name: string; at: number }[] = [];

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

function verboseEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.location.search.includes('perf=1')) return true;
    if (window.localStorage.getItem('astrovia:perf') === '1') return true;
  } catch {
    /* storage blocked */
  }
  return false;
}

/** Start a named timer. Returns the start timestamp to hand to `end()`. */
export function start(): number {
  return now();
}

/** Milliseconds since a `start()` timestamp, without recording anything. */
export function elapsed(since: number): number {
  return Math.max(0, now() - since);
}

/** Name a start timestamp so a later call can measure from it. */
export function end(name: string, since: number, meta?: Record<string, unknown>): number {
  const ms = Math.max(0, now() - since);
  entries.push({ name, ms, at: Date.now(), ...(meta ? { meta } : {}) });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  if (verboseEnabled()) {
    const rounded = Math.round(ms);
    if (meta) console.info(`[perf] ${name}: ${rounded}ms`, meta);
    else console.info(`[perf] ${name}: ${rounded}ms`);
  }
  return ms;
}

/** Increment a counter (created on first use). */
export function count(key: string, by = 1): void {
  counters.set(key, (counters.get(key) ?? 0) + by);
}

/** Read a counter without changing it. */
export function counterValue(key: string): number {
  return counters.get(key) ?? 0;
}

export function snapshot(): PerfSnapshot {
  return {
    entries: entries.map((e) => ({ ...e })),
    counters: Object.fromEntries(counters),
    marks: bootMarks.map((m) => ({ ...m })),
  };
}

/** Print a compact summary — used by the `?perf=1` mode. */
export function report(): void {
  const snap = snapshot();
  const avg = (name: string): string => {
    const hits = snap.entries.filter((e) => e.name === name);
    if (!hits.length) return '—';
    const mean = hits.reduce((sum, e) => sum + e.ms, 0) / hits.length;
    return `${Math.round(mean)}ms (n=${hits.length})`;
  };
  console.groupCollapsed('[perf] Astrovia summary');
  console.table(snap.counters);
  console.table({
    bootstrap: avg('bootstrap.total'),
    'chart (cache)': avg('chart.cachePaint'),
    'chart (network)': avg('chart.network'),
    'acharya history (cache)': avg('acharya.cachePaint'),
    'acharya history (network)': avg('acharya.network'),
    'tab switch': avg('nav.commit'),
  });
  console.groupEnd();
}

/** Called once from the app shell after mount to capture navigation timing. */
export function captureBootTimings(): void {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return;
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      bootMarks.push({ name: 'domContentLoaded', at: Math.round(nav.domContentLoadedEventEnd) });
      bootMarks.push({ name: 'load', at: Math.round(nav.loadEventEnd) });
      bootMarks.push({ name: 'responseStart', at: Math.round(nav.responseStart) });
    }
  } catch {
    /* unsupported */
  }
}

declare global {
  interface Window {
    __astroviaPerf?: {
      snapshot: typeof snapshot;
      report: typeof report;
      entries: PerfEntry[];
    };
  }
}

if (typeof window !== 'undefined') {
  window.__astroviaPerf = { snapshot, report, entries };
  captureBootTimings();
}
