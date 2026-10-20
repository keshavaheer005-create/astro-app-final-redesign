/**
 * Capacitor native bridge — thin, web-safe wrappers around the Android
 * plugins. Every call degrades gracefully on the web build:
 *   • Geolocation      → falls back to navigator.geolocation
 *   • Preferences      → no-op on web (zustand/localStorage already persists)
 *   • SpeechRecognition→ returns null on web (Acharya mic keeps MediaRecorder)
 *   • PushNotifications→ NOT started yet (needs Firebase; see initPush)
 *   • LocalNotifications→ daily check-in reminders that work with the app closed
 *   • Share / Filesystem→ system share sheet + saving the data export
 *
 * Every native call is guarded with Capacitor.isPluginAvailable: the website is
 * served live from Render, so it can be newer than an installed APK — a plugin
 * missing from an old APK just switches that feature off instead of crashing.
 *
 * Nothing here touches server secrets; plugin config lives in
 * capacitor.config.ts.
 */
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

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
    // Keep recognition in-app. popup:true opens the system/Google speech UI,
    // which breaks the app's inline listening experience.
    partialResults: false,
    popup: false,
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

/* ── Share + file export ─────────────────────────────────────────────────── */

/** Opens the system share sheet (web: Web Share API, else copies to clipboard). */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied'> {
  if (isNative() && Capacitor.isPluginAvailable('Share')) {
    await Share.share({ title, text, dialogTitle: title });
    return 'shared';
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share({ title, text });
    return 'shared';
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}

/**
 * Saves a text file for the user. Web: normal download. Android WebView cannot
 * download blob: links, so there it writes the file to the app cache and opens
 * the share sheet ("Save to Drive / Files / send").
 */
export async function saveTextFile(filename: string, content: string, mime = 'application/json'): Promise<void> {
  if (isNative() && Capacitor.isPluginAvailable('Filesystem') && Capacitor.isPluginAvailable('Share')) {
    const res = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: filename, url: res.uri, dialogTitle: filename });
    return;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Daily check-in reminders (local notifications) ──────────────────────── */

const REMINDER_BASE_ID = 1000;
const REMINDER_DAYS = 14;
const REMINDER_CHANNEL = 'daily-checkin';

/** Cancels every reminder this app scheduled (sign-out, clear data, reminder turned off). */
export async function cancelDailyReminders(): Promise<void> {
  if (!isNative() || !Capacitor.isPluginAvailable('LocalNotifications')) return;
  try {
    await LocalNotifications.cancel({
      notifications: Array.from({ length: REMINDER_DAYS }, (_, i) => ({ id: REMINDER_BASE_ID + i })),
    });
  } catch {
    /* nothing pending */
  }
}

/**
 * Keeps a rolling window of the next 14 daily reminders on the phone. Re-run on
 * every app open / setting change, so it stays fresh, and today's is skipped once the
 * user has already checked in. Uses inexact scheduling (no exact-alarm permission).
 */
export async function syncDailyReminders(opts: {
  enabled: boolean;
  time: string; // HH:MM, local time
  title: string;
  body: string;
  channelName: string;
  skipToday: boolean;
}): Promise<void> {
  if (!isNative() || !Capacitor.isPluginAvailable('LocalNotifications')) return;
  await cancelDailyReminders();
  if (!opts.enabled) return;

  let perm = await LocalNotifications.checkPermissions();
  if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
    perm = await LocalNotifications.requestPermissions();
  }
  if (perm.display !== 'granted') return;

  const [h, m] = opts.time.split(':').map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return;

  try {
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL,
      name: opts.channelName,
      importance: 3,
      visibility: 1,
    });
  } catch {
    /* channels exist only on Android 8+ */
  }

  const now = new Date();
  const notifications: {
    id: number;
    title: string;
    body: string;
    channelId: string;
    schedule: { at: Date; allowWhileIdle: boolean };
    isExactNotification: boolean;
    extra: { target: string };
  }[] = [];
  for (let day = 0; day <= REMINDER_DAYS && notifications.length < REMINDER_DAYS; day++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, h, m, 0, 0);
    if (at.getTime() <= now.getTime() + 30_000) continue; // time already passed today
    if (day === 0 && opts.skipToday) continue; // already checked in today
    notifications.push({
      id: REMINDER_BASE_ID + notifications.length,
      title: opts.title,
      body: opts.body,
      channelId: REMINDER_CHANNEL,
      schedule: { at, allowWhileIdle: true },
      // Inexact on purpose. The plugin defaults to EXACT alarms and, when Android has not
      // granted them, opens the system "Alarms & reminders" screen every time it schedules.
      // This app does not declare that permission (it would need a Google Play declaration),
      // so the app is not even listed there and the user would be stuck in a loop.
      isExactNotification: false,
      extra: { target: 'checkin' },
    });
  }
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

/** Calls `cb` when the user taps a reminder (also when it launched the app). Returns an unsubscribe. */
export function onReminderTapped(cb: () => void): () => void {
  if (!isNative() || !Capacitor.isPluginAvailable('LocalNotifications')) return () => undefined;
  let handle: { remove: () => Promise<void> } | undefined;
  let removed = false;
  void LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    if ((e.notification.extra as { target?: string } | undefined)?.target === 'checkin') cb();
  }).then((h) => {
    if (removed) void h.remove();
    else handle = h;
  });
  return () => {
    removed = true;
    void handle?.remove();
  };
}

/* ── Push notifications (native only) ────────────────────────────────────── */

/**
 * NOT called anywhere yet. Remote push on Android needs a Firebase project and
 * android/app/google-services.json in the APK — calling register() without it
 * crashes the app. Enable only after that file is added (and the server stores
 * the token and sends the pushes).
 */
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
