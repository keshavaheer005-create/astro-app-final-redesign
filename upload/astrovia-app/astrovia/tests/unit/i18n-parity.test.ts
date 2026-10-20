/// <reference types="bun-types" />
/**
 * Guard rail for the bilingual UI: every key must exist in BOTH locales.
 * Adding a string to en.json and forgetting hi.json (or vice versa) fails here
 * instead of silently rendering a raw key for half the users.
 */
import { describe, expect, test } from 'bun:test';
import en from '../../src/i18n/locales/en.json';
import hi from '../../src/i18n/locales/hi.json';

const enKeys = Object.keys(en as Record<string, string>).sort();
const hiKeys = Object.keys(hi as Record<string, string>).sort();

describe('i18n key parity', () => {
  test('every English key exists in Hindi', () => {
    const missing = enKeys.filter((k) => !hiKeys.includes(k));
    expect(missing).toEqual([]);
  });

  test('every Hindi key exists in English', () => {
    const missing = hiKeys.filter((k) => !enKeys.includes(k));
    expect(missing).toEqual([]);
  });

  test('no key has an empty translation', () => {
    const blankEn = enKeys.filter((k) => !String((en as Record<string, string>)[k]).trim());
    const blankHi = hiKeys.filter((k) => !String((hi as Record<string, string>)[k]).trim());
    expect(blankEn).toEqual([]);
    expect(blankHi).toEqual([]);
  });

  test('interpolation placeholders match between locales', () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
    const mismatched = enKeys.filter((k) => {
      const a = placeholders(String((en as Record<string, string>)[k])).join(',');
      const b = placeholders(String((hi as Record<string, string>)[k])).join(',');
      return a !== b;
    });
    expect(mismatched).toEqual([]);
  });
});
