# Deploying Astrovia (Render + Supabase, auto-deploy from GitHub)

This is the path you use: **push to GitHub → Render rebuilds → the live app talks
to your Supabase Postgres.** Nothing needs to be run by hand for the current
release, because it contains **no schema change**.

---

## 1. How the pipeline works (Bun)

```
git push  ─►  GitHub  ─►  Render build                  ─►  Render start
                          bun install                      bun .next/standalone/server.js
                          bunx prisma generate
                          bun run build
```

* `render.yaml` (Blueprint) sets `autoDeploy: true`, so every push to the
  connected branch deploys.
* `bun install` installs devDependencies too — required, because `bun run build`
  (`next build`) now runs a **TypeScript check**. Do not switch the build to
  `bun install --production`.
* `bunx prisma generate` runs at build time — the Prisma client must match
  `prisma/schema.prisma` or the server throws at import.
* `bun.lock` is unchanged from your current pipeline (this release adds no
  dependencies), so `bun install --frozen-lockfile` keeps working if that is what
  you use. `preinstall`-style lifecycle scripts (`sweph`) run as before.
* The server refuses to boot if `SESSION_SECRET` is missing/weak.

If your Render service was created **manually** (not from `render.yaml`), set
these two commands in Render → Settings instead — the Blueprint is not applied:

| Setting | Value |
| --- | --- |
| Build Command | `bun install && bunx prisma generate && bun run build` |
| Start Command | `bun .next/standalone/server.js` |

(`bun run start` also works; it pipes the server through `tee server.log`.)

### Before you push: new files are easy to lose

A release adds files that git does not know about yet. `git commit -am "…"`
stages **only files git already tracks**, so a brand-new module is left behind
and Render fails with `Module not found: Can't resolve '@/lib/…'` — while the
same build passes on your machine, because the file is on disk there.

```bash
git status --short                        # '??' lines are untracked
git ls-files --others --exclude-standard  # must print NOTHING before a release push
git add -A                                # ← not `-a` alone
git commit -m "…"
```

And in Render → *Settings → Build & Deploy*, enable **Wait for CI checks** —
`.github/workflows/ci.yml` runs the same type-check and build, so a commit with
a missing file never reaches production.

## 2. Environment variables (Render → Environment)

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | **yes** | Supabase → Project Settings → Database → Connection string (URI). Use the **Session pooler, port 5432**. See §4 if you use the transaction pooler (6543). |
| `SESSION_SECRET` | **yes** | 32+ random characters. Blueprint sets `generateValue: true`. Rotating it signs everyone out by design. |
| `NEXT_PUBLIC_SUPABASE_URL` | for Google/email sign-in | Public anon URL. `NEXT_PUBLIC_*` is inlined **at build time** — change it, then redeploy. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for Google/email sign-in | Public anon key (never the service-role key). |
| `NEXT_PUBLIC_SITE_URL` | recommended | Canonical URL, used for OAuth redirects, e.g. `https://astrovia.onrender.com`. |
| `NVIDIA_API_KEY` | for Acharya | Backend only. Never `NEXT_PUBLIC_`. |
| `ACHARYA_MODEL` / `ACHARYA_FAST_MODEL` / `ACHARYA_FALLBACK_MODEL` | optional | Defaults are in `.env.example`. |
| `NODE_VERSION` | if the runtime is Node | `22` (set by the Blueprint). Ignored by a Bun runtime. |
| `BUN_VERSION` | if the runtime is Bun | Optional pin, e.g. match your local `bun --version`. |
| `NEXT_PUBLIC_API_BASE_URL` | only for a split app | Leave empty when the WebView loads the Render URL. |

`ASTROVIA_ALLOW_INSECURE_SESSION_SECRET=1` exists **only** for a throwaway demo;
never set it on a real deployment.

## 3. First deploy of this release — what actually changed

* **No database migration.** No new tables or columns. Your existing Supabase
  database keeps working untouched.
* The session cookie format changed to a signed, expiring token. Old cookies are
  verified once and re-issued in the new format, so **users stay signed in**.
* If `SESSION_SECRET` was never set on an older service, the build still
  deploys but the app **cannot sign anyone in**, `/api` answers **503**, and
  Render marks the deploy unhealthy (the previous version keeps serving).
  Add the variable in Render → Environment, or let the Blueprint generate it,
  then redeploy. This is the security gate, not a bug.

## 4. Supabase connection strings (important)

Supabase offers three connection strings for Postgres. For a long-lived Node
server with Prisma:

* **Session pooler, port 5432 (recommended default)** — works for both the app
  and for `prisma migrate deploy`.
* **Transaction pooler, port 6543** — Prisma needs
  `?pgbouncer=true&connection_limit=1` appended, and migrations do **not** work
  through it. If you must use it, run migrations with the 5432 URI separately.
* **Direct connection** — fine for a single instance, but uses one connection per
  process and may hit Supabase's limit on serverless/scale-to-zero.

If the database was paused by Supabase (free tier), the first request after the
pause can fail; the app recovers on the next request.

## 5. Verifying a deploy

Open `https://<your-service>/api` — it returns booleans only, never secrets:

```json
{
  "ok": true,
  "service": "astrovia",
  "db": true,             // Prisma reached Postgres
  "migrated": true,       // per-chart/Supabase migration present
  "supabaseKeys": true,   // NEXT_PUBLIC_SUPABASE_* present
  "sessionSecret": true,  // SESSION_SECRET present
  "sessionSecretOk": true,
  "ts": "2026-10-19T..."
}
```

* **HTTP 503** → `SESSION_SECRET` is missing or not production-grade. The
  response then also carries `sessionSecretProblems` (rule descriptions, never
  the value). Fix the env var and redeploy; Render treats the 503 as an
  unhealthy deploy and keeps the previous version serving.
* `db: false` → wrong `DATABASE_URL`, Supabase paused, or IP/connection limits.
  The status stays 200 on purpose (a database hiccup must not flap deploys) —
  alert on the field.
* The endpoint intentionally answers 200 even when `db` is false, so a database
  hiccup does not flap the deploy; alert on the field instead.

## 6. If you add a schema change later

This release has none, but for the next one:

1. Locally: edit `prisma/schema.prisma`, then
   `bunx prisma migrate dev --name <change>` (creates a migration file) and
   commit it.
2. If your database was originally created with `prisma db push` (no migration
   history), `prisma migrate deploy` will fail with **P3005**. Baseline it once:
   `bunx prisma migrate resolve --applied <initial migration name>`.
3. Once `bunx prisma migrate status` is clean against the Supabase URL, you can
   add `preDeployCommand: bunx prisma migrate deploy` to `render.yaml` so every
   future deploy migrates automatically before traffic switches.
4. Until then, run migrations manually:
   `DATABASE_URL="<supabase-uri>" bunx prisma migrate deploy`.

## 7. Optional hardening

* **Gate deploys on CI.** `.github/workflows/ci.yml` runs typecheck, unit tests,
  lint and a production build on every push (Bun, pinned to the version this repo
  was verified with). In Render, enable *Settings → Build & Deploy → Wait for CI
  checks* (or deploy from a branch that requires the check) so a red build cannot
  reach production.
* **Keep `bun.lock` committed** — it is what makes `bun install` reproducible on
  Render; do not delete it or add dependencies without updating it.
* **Rotate `SESSION_SECRET`** if it was ever exposed; that signs everyone out.
* **Keep `NVIDIA_API_KEY` server-side only** and rotate it if it leaks.

## 8. Rollback

Render keeps previous deploys: *Events → Deploy → Rollback*. Because this
release changes no schema, rolling back is safe in both directions. (The only
client-side consequence is that older builds do not read the new on-device
cache keys; they simply re-fetch.)
