'use client';

import { useEffect } from 'react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { resources } from '@/i18n/locales';
import { useAppStore } from '@/store/app';

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

export function Providers({ children }: { children: React.ReactNode }) {
  const language = useAppStore((s) => s.language);
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const highContrast = useAppStore((s) => s.highContrast);

  useEffect(() => {
    if (i18next.language !== language) i18next.changeLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle('reduce-motion', reduceMotion);
    el.classList.toggle('high-contrast', highContrast);
  }, [reduceMotion, highContrast]);

  initI18n(language);

  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}
