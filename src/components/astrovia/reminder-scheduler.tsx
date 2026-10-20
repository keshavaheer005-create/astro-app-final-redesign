'use client';

import { useEffect, useRef } from 'react';
import i18next from 'i18next';
import { api } from './session-context';
import { useAppStore } from '@/store/app';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { isNative, syncDailyReminders } from '@/lib/native';

/**
 * Client-side reminder scheduler — turns the Profile "daily check-in reminder"
 * into a real, firing notification. Mounted once at the app root.
 *
 * Every 15s it checks whether the local clock has reached the saved reminder
 * time (HH:MM). When the minute matches (and it has not fired today) it asks
 * /api/checkins whether today's check-in is still pending; if it is, it:
 *   1. dispatches `ss:reminder-fired` (Home's bell picks it up → dot + wiggle)
 *   2. raises a rich toast with a "Check in now" action that navigates to the
 *      Home check-in card (via the store's one-shot pendingFocus handoff).
 * The fired flag is persisted per-day in localStorage, so a reminder is never
 * shown twice for the same day even across reloads.
 */
export function ReminderScheduler() {
  const { toast } = useToast();
  const busyRef = useRef(false);
  const reminderEnabled = useAppStore((s) => s.reminderEnabled);
  const reminderTime = useAppStore((s) => s.reminderTime);
  const language = useAppStore((s) => s.language);

  // Android app: keep real phone notifications in step with the Profile settings
  // (works with the app closed). Re-runs on every setting change and whenever the app comes to the front.
  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;
    const run = async () => {
      let checkedInToday = false;
      try {
        const res = await api<{ checkedInToday: boolean }>(`/api/checkins?lang=${language}`);
        checkedInToday = res.checkedInToday;
      } catch {
        return; // guest / signed out / offline → leave the current schedule untouched
      }
      if (cancelled) return;
      const t = i18next.t.bind(i18next);
      await syncDailyReminders({
        enabled: reminderEnabled,
        time: reminderTime,
        title: t('notifications.reminderToastTitle'),
        body: t('notifications.reminderToastBody', { time: reminderTime }),
        channelName: t('notifications.reminderChannel'),
        skipToday: checkedInToday,
      });
    };
    void run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reminderEnabled, reminderTime, language]);

  useEffect(() => {
    const check = async () => {
      if (busyRef.current) return;
      const { reminderEnabled, reminderTime, language } = useAppStore.getState();
      if (!reminderEnabled) return;

      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (hhmm !== reminderTime) return;

      const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const firedKey = `ss-remind-fired-${dayKey}`;
      try {
        if (window.localStorage.getItem(firedKey)) return;
        window.localStorage.setItem(firedKey, '1');
      } catch {
        /* storage unavailable — still fire, just without dedupe */
      }

      busyRef.current = true;
      let checkedInToday = false;
      try {
        const res = await api<{ checkedInToday: boolean }>(`/api/checkins?lang=${language}`);
        checkedInToday = res.checkedInToday;
      } catch {
        busyRef.current = false;
        return; // offline / server hiccup — try again next tick (flag not persisted on failure)
      }
      busyRef.current = false;
      if (checkedInToday) return;

      const t = i18next.t.bind(i18next);
      window.dispatchEvent(new CustomEvent('ss:reminder-fired'));
      toast({
        title: t('notifications.reminderToastTitle'),
        description: t('notifications.reminderToastBody', { time: reminderTime }),
        duration: 15000,
        action: (
          <ToastAction
            altText={t('notifications.reminderToastAction')}
            onClick={() => {
              useAppStore.getState().pushPendingFocus('checkin');
              window.dispatchEvent(new CustomEvent('ss:navigate', { detail: { tab: 'home' } }));
            }}
          >
            {t('notifications.reminderToastAction')}
          </ToastAction>
        ),
      });
    };

    const id = setInterval(() => void check(), 15000);
    void check(); // run once on mount — covers "app opened exactly at the reminder minute"
    return () => clearInterval(id);
  }, [toast]);

  return null;
}
