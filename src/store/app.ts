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
  setLanguage: (l: Language) => void;
  setReduceMotion: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setReminder: (enabled: boolean, time: string) => void;
  setWeeklyReflection: (v: boolean) => void;
  pushAcharyaDraft: (text: string) => void;
  consumeAcharyaDraft: () => string | null;
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
        // acharyaDraft intentionally NOT persisted — it is a one-shot handoff
      }),
    },
  ),
);
