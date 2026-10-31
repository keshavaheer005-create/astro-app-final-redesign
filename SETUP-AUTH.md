# Astrovia — sign-in setup (Supabase + Google + email code + Render + Android app)

## How it works

```
 App (Android WebView / browser)                 Supabase Auth                Render server
 ───────────────────────────────                 ─────────────                ─────────────
 1. Sign up / sign in / Google  ───────────────▶  creates the login
 2. Supabase emails a 6-digit code (or Google)
 3. User types the code ────────────────────────▶  verifies it, returns a session
 4. App sends the Supabase access token ──────────────────────────────────▶  asks Supabase "is this token valid,
                                                                              and whose is it?" → finds / creates
                                                                              our user row → sets the signed
                                                                              httpOnly session cookie
 5. Every later API call uses that cookie (same origin: the app loads your Render URL)
```

* Passwords and codes only ever go to Supabase. Your server stores no passwords for these accounts.
* Only **verified** emails get an account (the code, or Google).
* Guests ("Continue without sign-up") keep working; when a guest signs up, their chart and journal move into the new account.
* With Supabase configured, the old local `/api/auth` signup/login endpoints are **closed** (they would skip the code check).

---

## 1. Database (once, before deploying)

This release adds per-chart data (each saved chart has its own journal, Acharya chat, weekly letters and decision checks) and links users to Supabase.

1. **Back up first**: Supabase → Database → Backups (or `pg_dump`).
2. From your machine:
   ```
   DATABASE_URL="<your Supabase connection string>" npx prisma migrate deploy
   ```
   The migration attaches all existing data to each user's *active* chart, so nothing is lost.
3. Deleting a chart now also deletes that chart's own data (the app should confirm this).

## 2. Supabase dashboard

**Authentication → Providers → Email**
* Email provider: **on**. **Confirm email: on** (this is what triggers the code).
* Optional: shorten the code lifetime (e.g. 10 minutes) in the same panel.

**Authentication → Email Templates** — edit **both** "Confirm signup" and "Reset password" so they send the *code* instead of a link:

```html
<h2>Your Astrovia code</h2>
<p>Enter this code in the app:</p>
<p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

**Authentication → URL Configuration**
* Site URL: `https://YOUR-APP.onrender.com`
* Redirect URLs (add all three):
  * `https://YOUR-APP.onrender.com/**`
  * `http://localhost:3000/**`
  * `com.astrovia.app://auth-callback`   ← the Android app's return address after Google

**Authentication → Providers → Google**: enabled with your Google client ID + secret (you already did this).

## 3. Sending the code emails without a domain (custom SMTP)

Supabase's built-in email sender only delivers to your own team members and allows about 2 emails/hour, so real users would never receive a code. You must add custom SMTP.

**No domain? Use a Gmail account** (fine for launch, about 500 emails/day):
1. Use a dedicated Gmail (e.g. astrovia.app@gmail.com). Turn on 2-Step Verification.
2. Create an **App Password**: Google Account → Security → App passwords → copy the 16 characters.
3. Supabase → **Authentication → SMTP Settings** → Enable custom SMTP:
   * Host `smtp.gmail.com`, Port `465`
   * Username: the Gmail address, Password: the 16-character app password
   * Sender email: the same Gmail address, Sender name: `Astrovia`
4. **Authentication → Rate Limits**: after enabling custom SMTP, Supabase still applies its own email limit; raise it (e.g. 30–60/hour) so launch-day signups are not blocked.

Later, when you own a domain, switch to Resend or Brevo (better inbox placement, higher limits) — only these SMTP fields change, no code.

## 4. Google Cloud Console

* Authorized redirect URI: **only** `https://<your-project-ref>.supabase.co/auth/v1/callback`.
* Do **not** put the app URL or `com.astrovia.app://…` here — those go in Supabase's Redirect URLs (step 2).
* OAuth consent screen: set Publishing status to **In production** (in "Testing" only the listed test users can sign in).
* No Android OAuth client is needed: the app opens Google in the system browser and returns through the deep link.

## 5. Render environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string |
| `SESSION_SECRET` | long random string (Render can generate it) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **anon / publishable** key (public by design) |
| `NEXT_PUBLIC_SITE_URL` | `https://YOUR-APP.onrender.com` |

* `NEXT_PUBLIC_*` values are baked in at **build** time: set them, then trigger a new deploy.
* Never put the Supabase **service-role** key in the app or in `NEXT_PUBLIC_*`. It is not needed.
* Heads-up: `render.yaml` names the service `astrovia`. If you deploy from that Blueprint and your live service has a different name, Render may create a *new* service with a new URL — then update the URLs in steps 2 and 4.

## 6. Android app (Capacitor)

The app runs in "remote mode": the WebView loads your Render URL.

```
npm install                      # picks up @capacitor/app and @capacitor/browser
CAPACITOR_SERVER_URL=https://YOUR-APP.onrender.com npx cap sync android
```
Then build in Android Studio. The Google button opens the system browser (Google blocks sign-in inside a WebView) and returns to the app through `com.astrovia.app://auth-callback`, which `AndroidManifest.xml` already registers.

## 7. Test checklist

1. Fresh install → the first screen is sign up / sign in (Google, or email + password), with "Continue without sign-up" at the bottom.
2. Sign up with email → a 6-digit code arrives → enter it → you land in onboarding.
3. Sign out, sign in with the same email + password → straight in.
4. "Forgot password?" → code arrives → set a new password → signed in.
5. Google (web, then Android app) → signed in; same Google email later signs into the same account.
6. Add a second chart and set it active: journal, Acharya chat, weekly letter and decision history are empty and separate; switch back and the first chart's data is intact.
7. Delete a chart → its own data goes with it; another chart becomes active.

## Troubleshooting

* **No email arrives** → SMTP not enabled/saved, wrong app password, or the Supabase email rate limit (step 3). Check the spam folder.
* **"That email already has an account"** on sign-up → the address already exists (maybe via Google). Sign in, or use Continue with Google. Supabase sends no email in this case.
* **Google: "redirect_uri_mismatch"** → the Supabase callback URL is missing in Google Cloud (step 4).
* **Google works on web but the app stays on the sign-in screen** → `com.astrovia.app://auth-callback` is missing in Supabase Redirect URLs, or the app was not rebuilt after `npm install` / `cap sync`.
* **Signed in but the app asks again** → the server could not verify the token: check `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` on Render and that you redeployed after setting them.
