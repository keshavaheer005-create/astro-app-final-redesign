'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'en' | 'hi';

interface AppState {
  language: Language;
  reduceMotion: boolean;
  highContrast: boolean;
  reminderEnabled: boolean;
  reminderTime: string; // HH:MM
  weeklyReflectionEnabled: boolean;
  /** One-shot composer draft handed to the Acharya screen (e.g. "discuss this journal note"). */
  acharyaDraft: string | null;
  /** One-shot focus target handed to Home (e.g. 'checkin' from the reminder toast). */
  pendingFocus: string | null;
  setLanguage: (l: Language) => void;
  setReduceMotion: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setReminder: (enabled: boolean, time: string) => void;
  setWeeklyReflection: (v: boolean) => void;
  pushAcharyaDraft: (text: string) => void;
  consumeAcharyaDraft: () => string | null;
  pushPendingFocus: (target: string) => void;
  consumePendingFocus: () => string | null;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      language: 'en',
      reduceMotion: false,
      highContrast: false,
      reminderEnabled: true,
      reminderTime: '20:00',
      weeklyReflectionEnabled: true,
      acharyaDraft: null as string | null,
      pendingFocus: null as string | null,
      setLanguage: (language) => set({ language }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setReminder: (reminderEnabled, reminderTime) => set({ reminderEnabled, reminderTime }),
      setWeeklyReflection: (weeklyReflectionEnabled) => set({ weeklyReflectionEnabled }),
      pushAcharyaDraft: (acharyaDraft) => set({ acharyaDraft }),
      consumeAcharyaDraft: () => {
        const draft = get().acharyaDraft;
        if (draft) set({ acharyaDraft: null });
        return draft;
      },
      pushPendingFocus: (pendingFocus) => set({ pendingFocus }),
      consumePendingFocus: () => {
        const target = get().pendingFocus;
        if (target) set({ pendingFocus: null });
        return target;
      },
    }),
    {
      name: 'selfsage-prefs',
      partialize: (s) => ({
        language: s.language,
        reduceMotion: s.reduceMotion,
        highContrast: s.highContrast,
        reminderEnabled: s.reminderEnabled,
        reminderTime: s.reminderTime,
        weeklyReflectionEnabled: s.weeklyReflectionEnabled,
        // acharyaDraft + pendingFocus intentionally NOT persisted — one-shot handoffs
      }),
    },
  ),
);
