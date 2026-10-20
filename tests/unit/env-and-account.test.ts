/// <reference types="bun-types" />
/**
 * Production secret gate + account adoption rules.
 */
import { describe, expect, test } from 'bun:test';
import { INSECURE_DEV_SECRET, MIN_SECRET_LENGTH, inspectSessionSecret } from '../../src/lib/env';
import { adoptAccount, readAccountPointer } from '../../src/lib/client-cache';
import { readChartSnapshot, writeChartSnapshot } from '../../src/lib/client-cache/charts';
import { readChatHistory, writeChatHistory } from '../../src/lib/client-cache/chat';
import { deleteByPrefix } from '../../src/lib/client-cache/idb';

describe('session secret inspection', () => {
  test('accepts a long random secret in production', () => {
    const found = inspectSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'f'.repeat(64) });
    expect(found.fatal).toBe(false);
    expect(found.problems).toEqual([]);
  });

  test('refuses a missing secret in production', () => {
    const found = inspectSessionSecret({ NODE_ENV: 'production' });
    expect(found.fatal).toBe(true);
    expect(found.problems.join(' ')).toContain('not set');
  });

  test('refuses the public development fallback in production', () => {
    const found = inspectSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: INSECURE_DEV_SECRET });
    expect(found.fatal).toBe(true);
  });

  test('refuses short secrets and documented placeholders', () => {
    expect(inspectSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'short' }).fatal).toBe(true);
    expect(
      inspectSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(MIN_SECRET_LENGTH - 1) }).fatal,
    ).toBe(true);
    expect(
      inspectSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'change-me-to-a-long-random-string' }).fatal,
    ).toBe(true);
  });

  test('development is never fatal', () => {
    const found = inspectSessionSecret({ NODE_ENV: 'development' });
    expect(found.fatal).toBe(false);
    expect(found.problems.length).toBeGreaterThan(0);
  });

  test('explicit escape hatch allows a demo deployment', () => {
    const found = inspectSessionSecret({
      NODE_ENV: 'production',
      ASTROVIA_ALLOW_INSECURE_SESSION_SECRET: '1',
    });
    expect(found.fatal).toBe(false);
  });
});

describe('account adoption', () => {
  const USER_A = 'user_aaaaaaaaaaaa';
  const USER_B = 'user_bbbbbbbbbbbb';
  const CHART = 'chart_one';

  test('the first account adopts cleanly', async () => {
    await deleteByPrefix('charts', '');
    await deleteByPrefix('chat', '');
    const result = await adoptAccount(USER_A);
    expect(result.switched).toBe(false);
    expect(readAccountPointer()).toBe(USER_A);
  });

  test('switching accounts wipes the previous account private data', async () => {
    await writeChartSnapshot(USER_A, CHART, { who: 'A' });
    await writeChatHistory(USER_A, CHART, [{ id: '1', role: 'user', content: 'private' }]);
    await adoptAccount(USER_A);

    const result = await adoptAccount(USER_B);
    expect(result.switched).toBe(true);
    expect(result.purged).toBeGreaterThanOrEqual(2);

    expect(await readChartSnapshot(USER_A, CHART)).toBeNull();
    expect(await readChatHistory(USER_A, CHART)).toBeNull();
    expect(readAccountPointer()).toBe(USER_B);
  });

  test('foreign rows are removed even when no pointer was stored', async () => {
    // Simulate an upgrade from a build that had no account pointer.
    await writeChartSnapshot('someone_else_1234', CHART, { who: 'stranger' });
    await adoptAccount(USER_B);
    expect(await readChartSnapshot('someone_else_1234', CHART)).toBeNull();
  });
});
