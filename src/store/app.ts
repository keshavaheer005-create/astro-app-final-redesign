'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_TOOL_IDS, normalizeToolIds } from '@/lib/quick-tools';

export type Language = 'en' | 'hi';

/** Screen atmosphere tones — the fixed full-viewport gradient behind each tab. */
export type ScreenTone = 'gold' | 'emerald' | 'violet' | 'rose' | 'burgundy';

interface AppState {
  language: Language;
  highContrast: boolean;
  reminderEnabled: boolean;
  reminderTime: string; // HH:MM
  weeklyReflectionEnabled: boolean;
  /** Active screen atmosphere — drives the fixed ScreenGradient (not persisted). */
  screenTone: ScreenTone;
  /** One-shot composer draft handed to the Acharya screen (e.g. "discuss this journal note"). */
  acharyaDraft: string | null;
  /** Journal date the draft refers to (threads the Acharya reply back to the entry). */
  acharyaDraftDate: string | null;
  /** One-shot focus target handed to Home/Journal (e.g. 'checkin', 'letter', 'journal:<date>'). */
  pendingFocus: string | null;
  /** Home shortcut ids, in the user's order (see lib/quick-tools.ts). */
  quickTools: string[];
  setLanguage: (l: Language) => void;
  setHighContrast: (v: boolean) => void;
  setReminder: (enabled: boolean, time: string) => void;
  setWeeklyReflection: (v: boolean) => void;
  setQuickTools: (ids: string[]) => void;
  pushAcharyaDraft: (text: string, journalDate?: string) => void;
  consumeAcharyaDraft: () => { text: string; journalDate: string | null } | null;
  pushPendingFocus: (target: string) => void;
  consumePendingFocus: () => string | null;
  setScreenTone: (t: ScreenTone) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      language: 'en',
      highContrast: false,
      reminderEnabled: true,
      reminderTime: '20:00',
      weeklyReflectionEnabled: true,
      screenTone: 'gold' as ScreenTone,
      acharyaDraft: null as string | null,
      acharyaDraftDate: null as string | null,
      pendingFocus: null as string | null,
      quickTools: [...DEFAULT_TOOL_IDS],
      setLanguage: (language) => set({ language }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setReminder: (reminderEnabled, reminderTime) => set({ reminderEnabled, reminderTime }),
      setWeeklyReflection: (weeklyReflectionEnabled) => set({ weeklyReflectionEnabled }),
      // Normalise on write: unknown ids, duplicates and over-long lists can
      // never reach the Home strip.
      setQuickTools: (ids) => set({ quickTools: normalizeToolIds(ids) }),
      pushAcharyaDraft: (acharyaDraft, journalDate) => set({ acharyaDraft, acharyaDraftDate: journalDate ?? null }),
      consumeAcharyaDraft: () => {
        const draft = get().acharyaDraft;
        const journalDate = get().acharyaDraftDate;
        if (draft) set({ acharyaDraft: null, acharyaDraftDate: null });
        return draft ? { text: draft, journalDate } : null;
      },
      pushPendingFocus: (pendingFocus) => set({ pendingFocus }),
      consumePendingFocus: () => {
        const target = get().pendingFocus;
        if (target) set({ pendingFocus: null });
        return target;
      },
      setScreenTone: (screenTone) => set({ screenTone }),
    }),
    {
      name: 'selfsage-prefs',
      partialize: (s) => ({
        language: s.language,
        highContrast: s.highContrast,
        reminderEnabled: s.reminderEnabled,
        reminderTime: s.reminderTime,
        weeklyReflectionEnabled: s.weeklyReflectionEnabled,
        quickTools: s.quickTools,
      // screenTone intentionally NOT persisted — derived per screen
        // acharyaDraft(+Date) + pendingFocus intentionally NOT persisted — one-shot handoffs
      }),
    },
  ),
);
