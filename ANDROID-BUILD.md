# Astrovia — build the Android app (Capacitor)

The Android app is a native shell whose WebView opens your live site
(`https://astrosage.onrender.com`). So:

| You change… | Reaches users… |
|---|---|
| Anything on the website / server (screens, text, AI prompts, API, database) | **Automatically**, as soon as Render deploys. No new APK, no Play update. |
| The native layer: plugins, permissions, app icon/name, splash, manifest, deep links, Firebase file, version | Only with a **new build uploaded to Play** and users updating. |

The site is also newer than old installs, so every native call in the code is guarded
(`Capacitor.isPluginAvailable`): a plugin missing from an old APK switches that feature
off instead of crashing.

## Plugins in the app

| Plugin | Used for | Status |
|---|---|---|
| core, android | the shell | in use |
| app, browser | Google sign-in (system browser + return deep link) | in use |
| geolocation | "Use my current location" | in use (permissions added to the manifest) |
| speech-recognition | Acharya voice input | in use |
| preferences | keeps the language setting | in use |
| local-notifications | daily check-in reminders, work with the app closed | in use |
| share | share-sheet for Kundli matching result | in use |
| filesystem | saves "Export my data" then opens the share sheet | in use |
| splash-screen, status-bar, keyboard | native look and keyboard behaviour (set in `capacitor.config.ts`) | in use |
| network, haptics | online/offline banner, vibration feedback | installed, not used yet |
| push-notifications | remote push from your server | installed but **off**: needs Firebase (below) |

## Fastest way: let GitHub build the APK (no Android Studio, no installs)

1. Push this project to your GitHub repository (the one Render deploys from). The workflow file is `.github/workflows/android.yml`.
2. GitHub → your repo → **Actions** → **Build Android app** → **Run workflow** (keep the default site URL) → wait about 8–15 minutes for the green tick.
3. Open the finished run → **Artifacts** → download **astrovia-debug-apk** → unzip → send `app-debug.apk` to your phone.
4. On the phone open the file and allow "install from this source". This test APK can NOT be uploaded to Google Play.

**For Google Play (signed bundle)** — one time:
1. Create an upload keystore (needs Java's `keytool`; it comes with Android Studio or any JDK):
   ```
   keytool -genkeypair -v -keystore astrovia-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias astrovia
   ```
   Keep `astrovia-upload.jks` and both passwords safe. Never commit the file.
2. Turn it into text. PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("astrovia-upload.jks"))`  (Mac/Linux: `base64 -w0 astrovia-upload.jks`).
3. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**, add four secrets:
   `ANDROID_KEYSTORE_BASE64` (the text from step 2), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`astrovia`), `ANDROID_KEY_PASSWORD`.
4. Run the workflow again: it now also publishes **astrovia-release-aab**, the signed bundle for Play.
5. `versionCode` goes up automatically with every GitHub run, so each new `.aab` is accepted by Play as an update. Raise `versionName` (e.g. 1.1) in `android/app/build.gradle` when you want users to see a new version number.

**No Java on your computer?** Make the keystore in the cloud with GitHub Codespaces (free monthly hours):
repo → green **Code** button → **Codespaces** → **Create codespace**. In its terminal run the `keytool` command from step 1, then `base64 -w0 astrovia-upload.jks`
(copy the long text into the secret), and right-click `astrovia-upload.jks` in the file list → **Download** to keep your backup. Then delete the codespace.

## Or build on your own computer

### One-time setup on your computer
1. **Node.js 22+** (check `node -v`).
2. **Android Studio "Otter" (2025.2.1) or newer** — it bundles JDK 21 (Capacitor 8 needs JDK 21).
   In Android Studio: *Settings → Build Tools → Gradle → Gradle JDK* = the bundled JDK 21.
3. In the project folder: `npm install`

## Build & run on a phone
1. Tell the build where your live site is (PowerShell):
   ```
   $env:CAPACITOR_SERVER_URL="https://astrosage.onrender.com"
   npm run cap:sync
   ```
   (Mac/Linux: `export CAPACITOR_SERVER_URL=https://astrosage.onrender.com`.)
   This also builds the offline page and refuses to run if the URL is missing.
2. `npm run cap:open` opens the `android` folder in Android Studio. Wait for Gradle sync to finish.
3. Plug in your phone (USB debugging on) or start an emulator, press the green **Run** button.
4. Test on the phone:
   - [ ] splash → Astrovia loads, header is not hidden under the status bar
   - [ ] sign up with email code, sign in with Google (opens Chrome, returns to the app)
   - [ ] "Use my current location" asks for permission and fills the place
   - [ ] Acharya mic works; matching → Share opens the Android share sheet
   - [ ] Profile → turn on reminder, set a time 2 minutes ahead, close the app → a notification arrives; tapping it opens the check-in
   - [ ] Profile → Export my data opens the share sheet
   - [ ] airplane mode → relaunch → "Can't reach the stars" page with Try again

## Make a release build
1. Android Studio → **Build → Generate Signed App Bundle / APK**.
2. **Android App Bundle (.aab)** is what Google Play needs; **APK** is for sending to friends to test.
3. Create a keystore the first time. **Back it up (file + both passwords)** — you cannot update the app without it
   (if you use Play App Signing, Google keeps the final signing key and this one is only your upload key).
4. Before every new release bump `versionCode` (+1) in `android/app/build.gradle`.

## Google Play
1. Play Console developer account: one-time **US$25** + identity verification.
2. Create the app, upload the `.aab` to **Internal testing** first.
3. **Personal accounts created after 13 Nov 2023 must run a closed test with 12 testers opted in for 14 continuous days** before applying for production (organization accounts are exempt).
4. Fill in: store listing (icon 512×512, feature graphic, screenshots), content rating, target audience,
   **privacy policy URL** (required), **Data safety** form (account email, birth details, location, voice, chat content),
   and the **account deletion** section (in-app "Clear all my data" exists; full account deletion URL is needed before production).
5. Keep the site fast: free Render services sleep after 15 minutes idle, so the first open can take up to a minute. A paid instance (or a free uptime ping to `/api` every 5–10 minutes) avoids that.

## Later: remote push notifications (needs a new build)
1. Firebase console → create a project → add an Android app with package `com.astrovia.app` → download `google-services.json` → put it in `android/app/`.
2. Add code that asks permission, sends the token to the server, and a server job that sends the pushes (not built yet — `initPush()` in `src/lib/native.ts` is deliberately not called anywhere because registering without `google-services.json` crashes the app).
3. Rebuild and upload a new version.
