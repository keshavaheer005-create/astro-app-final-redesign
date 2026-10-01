import en from './en.json';
import hi from './hi.json';

export const resources = {
  en: { translation: en },
  hi: { translation: hi },
} as const;

export type SupportedLanguage = keyof typeof resources;
