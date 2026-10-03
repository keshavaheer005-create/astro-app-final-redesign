import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Astrovia — Capacitor configuration.
 *
 * Architecture: the Next.js app (Swiss Ephemeris, Prisma/Postgres, AI, TTS,
 * ASR) runs on a real server — it cannot be bundled into the APK. The
 * Android WebView therefore loads the DEPLOYED site URL directly
 * (remote-app mode):
 *
 *   1. Set CAPACITOR_SERVER_URL to your deployed backend before
 *      `npx cap sync` (e.g. https://astrovia.example.com).
 *   2. `npx cap add android` + `npx cap sync android`, then build in
 *      Android Studio — the APK opens that URL full-screen.
 *   3. For local device testing against your dev machine use the Android
 *      emulator loopback: http://10.0.2.2:3000 (cleartext is allowed below
 *      for that case; keep it false in hardened production builds).
 *
 * If no CAPACITOR_SERVER_URL is present at sync time it falls back to the
 * local dev server. API calls themselves are same-origin relative paths,
 * or prefixed with NEXT_PUBLIC_API_BASE_URL when the client is served
 * separately (see src/lib/api.ts).
 */
const config: CapacitorConfig = {
  appId: 'com.astrovia.app',
  appName: 'Astrovia',
  // Standby bundle: the WebView is redirected to server.url below. `public/`
  // keeps `cap sync` happy and provides splash/icon assets.
  webDir: 'public',
  server: {
    url: process.env.CAPACITOR_SERVER_URL ?? 'http://10.0.2.2:3000',
    cleartext: true, // required for http:// dev targets; remove for https-only prod
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#FAF7F0',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SpeechRecognition: {
      // @capacitor-community/speech-recognition — matches app languages
      extraLanguages: ['hi-IN'],
    },
  },
};

export default config;
