/// <reference types="bun-types" />
/**
 * Account/chart isolation and version invalidation for the on-device chart
 * snapshot cache. Runs against the in-memory backend (no IndexedDB in bun).
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import {
  chartCacheKey,
  deleteAllChartSnapshots,
  isSnapshotUsable,
  pruneStaleSnapshots,
  readChartSnapshot,
  writeChartSnapshot,
} from '../../src/lib/client-cache/charts';
import { CHART_ENGINE_VERSION, deleteByPrefix, writeEnvelope } from '../../src/lib/client-cache/idb';

const USER_A = 'user_aaaaaaaaaaaa';
const USER_B = 'user_bbbbbbbbbbbb';
const CHART_1 = 'chart_one';
const CHART_2 = 'chart_two';

async function reset(): Promise<void> {
  await deleteByPrefix('charts', '');
  await deleteByPrefix('chat', '');
}

describe('chart snapshot keys', () => {
  test('key is ids only - never birth data', async () => {
    const key = chartCacheKey(USER_A, CHART_1);
    expect(key).toBe(`${USER_A}|${CHART_1}`);
    expect(key).not.toContain('1990');
    expect(key.split('|')).toHaveLength(2);
  });

  test('isSnapshotUsable rejects another user, another chart, another engine', () => {
    const meta = { userId: USER_A, chartId: CHART_1, engineVersion: CHART_ENGINE_VERSION };
    expect(isSnapshotUsable(meta, { userId: USER_A, chartId: CHART_1 })).toBe(true);
    expect(isSnapshotUsable(meta, { userId: USER_B, chartId: CHART_1 })).toBe(false);
    expect(isSnapshotUsable(meta, { userId: USER_A, chartId: CHART_2 })).toBe(false);
    expect(
      isSnapshotUsable({ ...meta, engineVersion: CHART_ENGINE_VERSION + 1 }, { userId: USER_A, chartId: CHART_1 }),
    ).toBe(false);
    expect(isSnapshotUsable(null, { userId: USER_A, chartId: CHART_1 })).toBe(false);
  });
});

describe('chart snapshot store', () => {
  beforeEach(reset);

  test('round-trips a chart for the owning account only', async () => {
    await writeChartSnapshot(USER_A, CHART_1, { ascendant: 'Leo' });

    const own = await readChartSnapshot<{ ascendant: string }>(USER_A, CHART_1);
    expect(own?.chart.ascendant).toBe('Leo');
    expect(own?.meta.userId).toBe(USER_A);

    // A different signed-in account must not see it, nor the same account on
    // a different chart.
    expect(await readChartSnapshot(USER_B, CHART_1)).toBeNull();
    expect(await readChartSnapshot(USER_A, CHART_2)).toBeNull();
  });

  test('a snapshot from an older engine version is ignored and pruned', async () => {
    // Simulate a row written by a previous engine build.
    await writeEnvelope('charts', chartCacheKey(USER_A, CHART_1), {
      userId: USER_A,
      chartId: CHART_1,
      engineVersion: CHART_ENGINE_VERSION - 1,
      chart: { ascendant: 'old' },
    });
    expect(await readChartSnapshot(USER_A, CHART_1)).toBeNull();

    await writeEnvelope('charts', chartCacheKey(USER_A, CHART_2), {
      userId: USER_A,
      chartId: CHART_2,
      engineVersion: CHART_ENGINE_VERSION - 1,
      chart: { ascendant: 'old' },
    });
    expect(await pruneStaleSnapshots(USER_A)).toBe(2);
  });

  test('deleting one account leaves the other intact', async () => {
    await writeChartSnapshot(USER_A, CHART_1, { who: 'A' });
    await writeChartSnapshot(USER_B, CHART_1, { who: 'B' });

    expect(await deleteAllChartSnapshots(USER_A)).toBe(1);
    expect(await readChartSnapshot(USER_A, CHART_1)).toBeNull();
    expect((await readChartSnapshot<{ who: string }>(USER_B, CHART_1))?.chart.who).toBe('B');
  });
});
