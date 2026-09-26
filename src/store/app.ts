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
  setLanguage: (l: Language) => void;
  setReduceMotion: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setReminder: (enabled: boolean, time: string) => void;
  setWeeklyReflection: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      language: 'en',
      reduceMotion: false,
      highContrast: false,
      reminderEnabled: true,
      reminderTime: '20:00',
      weeklyReflectionEnabled: true,
      setLanguage: (language) => set({ language }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setReminder: (reminderEnabled, reminderTime) => set({ reminderEnabled, reminderTime }),
      setWeeklyReflection: (weeklyReflectionEnabled) => set({ weeklyReflectionEnabled }),
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
      }),
    },
  ),
);
