/**
 * Account-scoped chart snapshots.
 *
 * The database stays authoritative. This cache exists so a chart that has
 * already been confirmed by the server can be painted without waiting for a
 * round trip (chart switching, returning to a screen, a slow network) and so a
 * stale snapshot is never shown for the wrong user, chart or engine version.
 *
 * Key:   `charts/<userId>|<chartId>`
 * Value: { userId, chartId, engineVersion, chart }
 *
 * The key contains ids only — never a birth date, time or coordinate.
 */
import {
  CHART_ENGINE_VERSION,
  deleteByPrefix,
  deleteKey,
  keysOf,
  readEnvelope,
  writeEnvelope,
} from './idb';

export interface CachedChartMeta {
  userId: string;
  chartId: string;
  engineVersion: number;
}

export interface ChartSnapshot<T = unknown> {
  chart: T;
  meta: CachedChartMeta;
  /** When this device wrote the snapshot (epoch ms). */
  savedAt: number;
}

export function chartCacheKey(userId: string, chartId: string): string {
  return `${userId}|${chartId}`;
}

/**
 * Pure validity rule — exported so it can be unit-tested without IndexedDB.
 * A snapshot is usable only when it belongs to exactly this account and chart
 * and was produced by the current calculation engine.
 */
export function isSnapshotUsable(
  meta: Partial<CachedChartMeta> | null | undefined,
  expected: { userId: string; chartId: string; engineVersion?: number },
): boolean {
  if (!meta) return false;
  if (!meta.userId || !meta.chartId) return false;
  if (meta.userId !== expected.userId) return false;
  if (meta.chartId !== expected.chartId) return false;
  const engine = expected.engineVersion ?? CHART_ENGINE_VERSION;
  return meta.engineVersion === engine;
}

export async function readChartSnapshot<T = unknown>(
  userId: string,
  chartId: string,
): Promise<ChartSnapshot<T> | null> {
  if (!userId || !chartId) return null;
  const env = await readEnvelope<CachedChartMeta & { chart?: T }>('charts', chartCacheKey(userId, chartId));
  if (!env?.value) return null;
  const { chart, ...meta } = env.value;
  if (chart == null) return null;
  if (!isSnapshotUsable(meta, { userId, chartId })) return null;
  return { chart, meta, savedAt: env.savedAt };
}

export async function writeChartSnapshot(
  userId: string,
  chartId: string,
  chart: unknown,
): Promise<void> {
  if (!userId || !chartId || chart == null) return;
  const value: CachedChartMeta & { chart: unknown } = {
    userId,
    chartId,
    engineVersion: CHART_ENGINE_VERSION,
    chart,
  };
  await writeEnvelope('charts', chartCacheKey(userId, chartId), value);
}

export async function deleteChartSnapshot(userId: string, chartId: string): Promise<void> {
  if (!userId || !chartId) return;
  await deleteKey('charts', chartCacheKey(userId, chartId));
}

/** Delete every snapshot for one account (sign-out, data deletion). */
export async function deleteAllChartSnapshots(userId: string): Promise<number> {
  if (!userId) return 0;
  return deleteByPrefix('charts', `${userId}|`);
}

/**
 * Drop snapshots written by a previous engine version for this account. Called
 * after adopting an account; cheap because the store only holds a few charts.
 */
export async function pruneStaleSnapshots(userId: string): Promise<number> {
  if (!userId) return 0;
  const keys = (await keysOf('charts')).filter((k) => k.startsWith(`${userId}|`));
  let removed = 0;
  for (const key of keys) {
    const env = await readEnvelope<CachedChartMeta>('charts', key);
    if (!env) {
      removed += 1; // already dropped by the schema check
      continue;
    }
    if (env.value?.engineVersion !== CHART_ENGINE_VERSION) {
      await deleteKey('charts', key);
      removed += 1;
    }
  }
  return removed;
}
