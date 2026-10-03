/**
 * Capacitor native bridge — thin, web-safe wrappers around the Android
 * plugins. Every call degrades gracefully on the web build:
 *   • Geolocation      → falls back to navigator.geolocation
 *   • Preferences      → no-op on web (zustand/localStorage already persists)
 *   • SpeechRecognition→ returns null on web (Acharya mic keeps MediaRecorder)
 *   • PushNotifications→ registers listeners only on native builds
 *
 * Nothing here touches server secrets; plugin config lives in
 * capacitor.config.ts.
 */
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { PushNotifications } from '@capacitor/push-notifications';

/** True when running inside a native (Android/iOS) shell. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/* ── Geolocation ─────────────────────────────────────────────────────────── */

export interface Coords {
  lat: number;
  lng: number;
}

/** One-shot device location (native plugin with web fallback). */
export async function getCurrentCoords(): Promise<Coords> {
  if (isNative()) {
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      const req = await Geolocation.requestPermissions();
      if (req.location !== 'granted' && req.coarseLocation !== 'granted') {
        throw new Error('permission_denied');
      }
    }
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000 });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    throw new Error('geolocation_unavailable');
  }
  return new Promise<Coords>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(new Error(err.code === 1 ? 'permission_denied' : 'location_failed')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

/* ── Preferences (device-key/value mirror of app settings) ───────────────── */

const PREF_LANG = 'selfsage.language';

export async function nativeGetLanguage(): Promise<string | null> {
  if (!isNative()) return null;
  const { value } = await Preferences.get({ key: PREF_LANG });
  return value;
}

export async function nativeSetLanguage(lang: string): Promise<void> {
  if (!isNative()) return;
  await Preferences.set({ key: PREF_LANG, value: lang });
}

/* ── Speech recognition (native dictation for the Acharya composer) ─────── */

/** Runs one native dictation pass; null on web (caller keeps MediaRecorder). */
export async function nativeSpeechTranscribe(language: 'en' | 'hi'): Promise<string | null> {
  if (!isNative() || !Capacitor.isPluginAvailable('SpeechRecognition')) return null;
  const { available } = await SpeechRecognition.available();
  if (!available) return null;
  const perm = await SpeechRecognition.checkPermissions();
  if (perm.speechRecognition !== 'granted') {
    const req = await SpeechRecognition.requestPermissions();
    if (req.speechRecognition !== 'granted') throw new Error('permission_denied');
  }
  const { matches } = await SpeechRecognition.start({
    language: language === 'hi' ? 'hi-IN' : 'en-US',
    maxResults: 1,
    partialResults: false,
    popup: true,
  });
  const text = matches?.[0];
  if (!text) return null;
  return text.slice(0, 600);
}

export async function nativeSpeechStop(): Promise<void> {
  if (!isNative() || !Capacitor.isPluginAvailable('SpeechRecognition')) return;
  try {
    await SpeechRecognition.stop();
  } catch {
    /* already stopped */
  }
}

/* ── Push notifications (native only) ────────────────────────────────────── */

export function initPush(onToken?: (token: string) => void): void {
  if (!isNative() || !Capacitor.isPluginAvailable('PushNotifications')) return;
  void PushNotifications.addListener('registration', (token) => onToken?.(token.value));
  void PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] registration failed:', err);
  });
  void PushNotifications.addListener('pushNotificationReceived', (n) => {
    console.info('[push] received:', n.title);
  });
  void PushNotifications.checkPermissions().then((p) => {
    if (p.receive === 'granted') void PushNotifications.register();
  });
}
