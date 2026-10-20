/// <reference types="bun-types" />
/** Saved AI insights are private, bounded and scoped to one account + chart. */
import { beforeEach, describe, expect, test } from 'bun:test';
import {
  deleteAllSavedInsights,
  deleteSavedInsightsForChart,
  readSavedInsights,
  removeSavedInsight,
  saveInsight,
} from '../../src/lib/client-cache/insights';
import { deleteByPrefix } from '../../src/lib/client-cache/idb';

const USER = 'user_aaaaaaaaaaaa';
const OTHER_USER = 'user_bbbbbbbbbbbb';
const CHART = 'chart_one';
const OTHER_CHART = 'chart_two';

const input = (overrides: Partial<Parameters<typeof saveInsight>[0]> = {}) => ({
  id: 'insight_one',
  userId: USER,
  chartId: CHART,
  title: 'Moon placement',
  content: 'A balanced interpretation of the Moon placement.',
  ...overrides,
});

beforeEach(async () => {
  await deleteByPrefix('meta', '');
});

describe('saved insight cache', () => {
  test('isolates data by account and chart', async () => {
    await saveInsight(input());
    await saveInsight(input({ id: 'other-chart', chartId: OTHER_CHART, content: 'Other chart insight.' }));
    await saveInsight(input({ id: 'other-user', userId: OTHER_USER, content: 'Other user insight.' }));

    expect((await readSavedInsights(USER, CHART)).map((item) => item.id)).toEqual(['insight_one']);
    expect(await readSavedInsights(USER, OTHER_CHART)).toHaveLength(1);
    expect(await readSavedInsights(OTHER_USER, CHART)).toHaveLength(1);
    expect(await readSavedInsights(OTHER_USER, OTHER_CHART)).toHaveLength(0);
  });

  test('deduplicates the same content while retaining a stable id', async () => {
    await saveInsight(input());
    const duplicate = await saveInsight(input({ id: 'new-id', title: 'Updated title' }));
    const items = await readSavedInsights(USER, CHART);

    expect(duplicate?.id).toBe('insight_one');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('insight_one');
    expect(items[0].title).toBe('Updated title');
  });

  test('removes one insight or a chart/account scope without touching other scopes', async () => {
    await saveInsight(input());
    await saveInsight(input({ id: 'same-user-other-chart', chartId: OTHER_CHART, content: 'Another chart.' }));
    await saveInsight(input({ id: 'other-user', userId: OTHER_USER, content: 'Another user.' }));

    await removeSavedInsight(USER, CHART, 'insight_one');
    expect(await readSavedInsights(USER, CHART)).toHaveLength(0);
    expect(await readSavedInsights(USER, OTHER_CHART)).toHaveLength(1);

    await deleteSavedInsightsForChart(USER, OTHER_CHART);
    expect(await readSavedInsights(USER, OTHER_CHART)).toHaveLength(0);
    expect(await deleteAllSavedInsights(OTHER_USER)).toBe(1);
    expect(await readSavedInsights(OTHER_USER, CHART)).toHaveLength(0);
  });

  test('bounds stored title and insight content', async () => {
    await saveInsight(input({ title: 'T'.repeat(200), content: 'C'.repeat(20_000) }));
    const [saved] = await readSavedInsights(USER, CHART);
    expect(saved.title).toHaveLength(120);
    expect(saved.content).toHaveLength(16_000);
  });
});
