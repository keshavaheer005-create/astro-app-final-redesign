/// <reference types="bun-types" />
/**
 * Quick Tools catalogue rules. These run on every read of the persisted
 * preference, so a corrupted list or an id from a removed tool can never break
 * the Home screen.
 */
import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_TOOL_IDS,
  MAX_TOOLS,
  QUICK_TOOL_CATALOGUE,
  TOOLS_PER_ROW,
  getTool,
  moveTool,
  normalizeToolIds,
  toggleTool,
  toolsFromIds,
} from '../../src/lib/quick-tools';

describe('catalogue', () => {
  test('every tool targets a screen that exists', () => {
    const tabs = ['kundli', 'journal', 'acharya', 'profile'];
    for (const tool of QUICK_TOOL_CATALOGUE) {
      expect(tabs).toContain(tool.tab);
      expect(tool.id.length).toBeGreaterThan(0);
      expect(tool.labelKey.startsWith('home.quick.')).toBe(true);
      expect(tool.bodyKey.startsWith('home.quickTools.body.')).toBe(true);
    }
  });

  test('ids are unique and defaults are all real tools', () => {
    const ids = QUICK_TOOL_CATALOGUE.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of DEFAULT_TOOL_IDS) expect(getTool(id)).toBeDefined();
  });

  test('the default strip fills exactly one row', () => {
    expect(DEFAULT_TOOL_IDS).toHaveLength(TOOLS_PER_ROW);
  });

  test('there are more tools than the default row, so editing is worthwhile', () => {
    expect(QUICK_TOOL_CATALOGUE.length).toBeGreaterThan(TOOLS_PER_ROW);
  });
});

describe('normalizeToolIds', () => {
  test('drops unknown and duplicate ids, keeping order', () => {
    expect(normalizeToolIds(['timeline', 'nope', 'acharya', 'timeline'])).toEqual(['timeline', 'acharya']);
  });

  test('falls back to the defaults when nothing usable is left', () => {
    expect(normalizeToolIds([])).toEqual(DEFAULT_TOOL_IDS);
    expect(normalizeToolIds(['removed-tool'])).toEqual(DEFAULT_TOOL_IDS);
    expect(normalizeToolIds(null)).toEqual(DEFAULT_TOOL_IDS);
    expect(normalizeToolIds('acharya')).toEqual(DEFAULT_TOOL_IDS);
  });

  test('clamps to the maximum', () => {
    const all = QUICK_TOOL_CATALOGUE.map((t) => t.id);
    expect(normalizeToolIds(all, MAX_TOOLS)).toHaveLength(Math.min(all.length, MAX_TOOLS));
    expect(normalizeToolIds(all, 2)).toEqual(all.slice(0, 2));
  });
});

describe('toggleTool', () => {
  test('adds a tool that is not there', () => {
    expect(toggleTool(['acharya'], 'timeline')).toEqual(['acharya', 'timeline']);
  });

  test('removes a tool that is there', () => {
    expect(toggleTool(['acharya', 'timeline'], 'acharya')).toEqual(['timeline']);
  });

  test('never empties the strip', () => {
    expect(toggleTool(['acharya'], 'acharya')).toEqual(DEFAULT_TOOL_IDS);
  });

  test('respects the cap', () => {
    const full = QUICK_TOOL_CATALOGUE.slice(0, MAX_TOOLS).map((t) => t.id);
    expect(toggleTool(full, QUICK_TOOL_CATALOGUE[MAX_TOOLS].id)).toEqual(full);
  });
});

describe('moveTool', () => {
  test('moves a tool forwards and backwards', () => {
    expect(moveTool(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveTool(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  test('ignores no-ops and out-of-range indexes', () => {
    expect(moveTool(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(moveTool(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
    expect(moveTool(['a', 'b'], 0, 9)).toEqual(['a', 'b']);
  });
});

describe('toolsFromIds', () => {
  test('resolves ids to definitions and skips unknown ones', () => {
    const out = toolsFromIds(['timeline', 'ghost', 'acharya']);
    expect(out.map((t) => t.id)).toEqual(['timeline', 'acharya']);
  });
});
