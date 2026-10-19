/**
 * Home "Quick Tools" catalogue.
 *
 * Every entry is a NAVIGATION target that already exists in the app — no tool
 * here performs a request of its own, so a shortcut can never trigger an API
 * call just by being on the home screen. Ids are stable strings (they are
 * persisted in zustand), so labels/icons can change freely.
 */
import type { IconName } from '@/components/astrovia/icons';

export type ToolTab = 'kundli' | 'journal' | 'acharya' | 'profile';

export interface ToolDef {
  id: string;
  icon: IconName;
  /** i18n key for the tile label. */
  labelKey: string;
  /** i18n key for the one-line description in the editor. */
  bodyKey: string;
  tab: ToolTab;
  /** Kundli/journal sub-view, when the destination has one. */
  view?: string;
}

/** Home shows this many tools per row. */
export const TOOLS_PER_ROW = 4;
/** Upper bound — more than two rows stops being "quick". */
export const MAX_TOOLS = 8;

/**
 * Order matters: it is the order of the "add" list in the editor.
 * `view: 'decision'` is the Decision Timing tool that lives inside Journal.
 */
export const QUICK_TOOL_CATALOGUE: ToolDef[] = [
  {
    id: 'acharya',
    icon: 'chat',
    labelKey: 'home.quick.acharya',
    bodyKey: 'home.quickTools.body.acharya',
    tab: 'acharya',
  },
  {
    id: 'panchang',
    icon: 'sun',
    labelKey: 'home.quick.panchang',
    bodyKey: 'home.quickTools.body.panchang',
    tab: 'kundli',
    view: 'panchang',
  },
  {
    id: 'decision',
    icon: 'compass',
    labelKey: 'home.quick.decision',
    bodyKey: 'home.quickTools.body.decision',
    tab: 'journal',
    view: 'decision',
  },
  {
    id: 'journal',
    icon: 'journal',
    labelKey: 'home.quick.journal',
    bodyKey: 'home.quickTools.body.journal',
    tab: 'journal',
  },
  {
    id: 'timeline',
    icon: 'timeline',
    labelKey: 'home.quick.timeline',
    bodyKey: 'home.quickTools.body.timeline',
    tab: 'kundli',
    view: 'timeline',
  },
  {
    id: 'reports',
    icon: 'grid',
    labelKey: 'home.quick.reports',
    bodyKey: 'home.quickTools.body.reports',
    tab: 'kundli',
    view: 'reports',
  },
  {
    id: 'matching',
    icon: 'handshake',
    labelKey: 'home.quick.matching',
    bodyKey: 'home.quickTools.body.matching',
    tab: 'kundli',
    view: 'matching',
  },
  {
    id: 'horoscope',
    icon: 'sparkle',
    labelKey: 'home.quick.horoscope',
    bodyKey: 'home.quickTools.body.horoscope',
    tab: 'kundli',
    view: 'horoscope',
  },
  {
    id: 'chart',
    icon: 'chart',
    labelKey: 'home.quick.chart',
    bodyKey: 'home.quickTools.body.chart',
    tab: 'kundli',
    view: 'chart',
  },
];

/** Today's four tiles — the safe default for anyone who never edits them. */
export const DEFAULT_TOOL_IDS: string[] = ['acharya', 'panchang', 'decision', 'journal'];

const BY_ID = new Map(QUICK_TOOL_CATALOGUE.map((tool) => [tool.id, tool]));

export function getTool(id: string): ToolDef | undefined {
  return BY_ID.get(id);
}

export function toolsFromIds(ids: readonly string[]): ToolDef[] {
  return ids.map((id) => BY_ID.get(id)).filter((tool): tool is ToolDef => Boolean(tool));
}

/**
 * Repair a persisted list: drop unknown/duplicate ids, clamp the length, and
 * fall back to the defaults when nothing usable is left. This runs on every
 * read, so an old build's preferences (or a corrupted localStorage entry) can
 * never blank out the home screen.
 */
export function normalizeToolIds(ids: unknown, max: number = MAX_TOOLS): string[] {
  const input = Array.isArray(ids) ? ids : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    if (!BY_ID.has(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length >= max) break;
  }
  if (out.length === 0) return [...DEFAULT_TOOL_IDS];
  return out;
}

/** Toggle a tool in the list, respecting `max`. Returns a normalised list. */
export function toggleTool(ids: readonly string[], id: string, max: number = MAX_TOOLS): string[] {
  const current = normalizeToolIds(ids, max);
  if (current.includes(id)) {
    const next = current.filter((x) => x !== id);
    // Never leave the strip empty — removing the last tool restores defaults.
    return next.length > 0 ? next : [...DEFAULT_TOOL_IDS];
  }
  if (current.length >= max) return current;
  return [...current, id];
}

/** Move a tool within the list (drag-and-drop result). */
export function moveTool(ids: readonly string[], from: number, to: number): string[] {
  const current = [...ids];
  if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) return current;
  const [moved] = current.splice(from, 1);
  current.splice(to, 0, moved);
  return current;
}
