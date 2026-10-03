'use client';

import { useEffect } from 'react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { resources } from '@/i18n/locales';
import { useAppStore, type Language } from '@/store/app';
import { initPush, nativeGetLanguage, nativeSetLanguage } from '@/lib/native';
import { ReminderScheduler } from './reminder-scheduler';

let initialized = false;

function initI18n(lng: string) {
  if (initialized) return i18next;
  i18next.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  initialized = true;
  return i18next;
}

// Initialize once at module scope — NOT during Providers' render. Calling
// i18next.init() mid-render synchronously notifies react-i18next subscribers
// and trips React's "cannot update a component while rendering another" guard.
// Zustand persist rehydrates localStorage synchronously, so the persisted
// language is available here.
initI18n(useAppStore.getState().language);

/**
 * Native (Capacitor) bootstrap: mirrors the app language into device
 * Preferences so it survives WebView storage wipes, hydrates it back on
 * launch, and registers push notifications. No-ops entirely on the web.
 */
function NativeBootstrap() {
  useEffect(() => {
    let unsub: (() => void) | undefined;
    void (async () => {
      const prefLang = await nativeGetLanguage();
      if (prefLang && prefLang !== useAppStore.getState().language) {
        useAppStore.getState().setLanguage(prefLang as Language);
      }
      // keep the device mirror in sync with in-app switches
      unsub = useAppStore.subscribe((state, prev) => {
        if (state.language !== prev.language) void nativeSetLanguage(state.language);
      });
      initPush();
    })();
    return () => unsub?.();
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const language = useAppStore((s) => s.language);
  const highContrast = useAppStore((s) => s.highContrast);

  useEffect(() => {
    if (i18next.language !== language) i18next.changeLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle('high-contrast', highContrast);
  }, [highContrast]);

  initI18n(language);

  return (
    <I18nextProvider i18n={i18next}>
      <NativeBootstrap />
      <ReminderScheduler />
      {children}
    </I18nextProvider>
  );
}
