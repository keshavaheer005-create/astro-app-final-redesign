# Change log — performance + secure client cache (2026-10-19)

Implements **wave 1 (performance foundation)** and **wave 2 (secure,
offline-friendly data)** of the upgrade plan, plus the security prerequisites
(wave 0). No feature-roadmap work (wave 3/4) is included.

Read `docs/CACHING.md` first: it holds the cache policy table, the purge matrix
and the deploy checklist.

## New files

| File | Purpose |
| --- | --- |
| `src/lib/perf.ts` | Bounded client timing/counter buffer, `window.__astroviaPerf`, `?perf=1` verbose mode |
| `src/lib/client-cache/idb.ts` | IndexedDB layer with memory fallback, timeouts, versioned envelopes |
| `src/lib/client-cache/charts.ts` | Account+chart scoped chart snapshots, engine-version validation, pruning |
| `src/lib/client-cache/chat.ts` | Bounded (40) confirmed Acharya history, pending-safe trimming |
| `src/lib/client-cache/index.ts` | Account adoption, foreign-row purge, sign-out/data-delete purges |
| `src/lib/session-token.ts` | Versioned, expiring, constant-time session token (v2) + legacy migration |
| `src/lib/env.ts` | Production session-secret inspection (fatal when weak/missing) |
| `src/instrumentation.ts` | Fails a production server boot on an insecure secret |
| `tests/unit/chart-cache.test.ts` | Chart isolation, version invalidation, per-account purge |
| `tests/unit/chat-cache.test.ts` | Chat scoping, bounding, pending/streaming exclusion, reconcile |
| `tests/unit/session-token.test.ts` | Signatures, tampering, expiry, legacy upgrade |
| `tests/unit/env-and-account.test.ts` | Secret gate + account-switch wipe |
| `.github/workflows/ci.yml` | typecheck → tests → lint → production build |
| `docs/CACHING.md` | Design, policy, measurement, deploy steps |
| `docs/CHANGES-2026-10-cache-wave.md` | This file |

## Changed files

| File | Change |
| --- | --- |
| `src/lib/api.ts` | Account-prefixed SWR keys, `freshMs` window, `onError`, `apiSWRWrite`, request perf counters |
| `src/lib/session.ts` | Uses the expiring v2 session token; legacy cookies upgraded in place |
| `src/lib/db.ts` | Prisma query logging is dev-only (no personal data in prod logs) |
| `src/app/api/auth/route.ts` | `?chart=1` also returns `chartId`; `private, no-store` |
| `src/app/api/charts/route.ts` | `private, no-store` on the private chart list |
| `src/components/astrovia/session-context.tsx` | `activeChartId`, `chartFromCache`, `activateChart`, `forgetChartSnapshot`; account adoption; snapshot paint/write |
| `src/components/astrovia/screens/acharya.tsx` | Instant cached history + server reconcile, `pending` turns never persisted, cache-clear on clear-chat |
| `src/components/astrovia/screens/home.tsx` | Check-ins paint from cache (30 s), panchang/sky/dasha freshness windows, cache scopes use chart id |
| `src/components/astrovia/screens/profile.tsx` | Chart switch through `activateChart`, snapshot purge on delete, device-cache card, purge on sign-out/clear-all |
| `src/components/astrovia/screens/kundli-tab.tsx` | `onViewChange` so the shell can remember the sub-view |
| `src/app/page.tsx` | Per-tab scroll restore, remembered Kundli sub-view, `nav.commit` perf mark |
| `src/i18n/locales/en.json`, `hi.json` | New strings (device-saved badge, device-cache card) |
| `next.config.ts` | `ignoreBuildErrors: false` (type errors fail the build) |
| `package.json` | `typecheck`, `test`, `check` scripts |
| `.env.example` | `SESSION_SECRET` guidance + escape hatch + perf switch |
| `worklog.md` | Task 27 entry |

## Verification performed here

* `bunx tsc --noEmit` — **passes** (0 errors).
* `bun test tests/unit` — **32 passing**, 0 failing.
* `bunx eslint <changed files>` — 0 errors (1 pre-existing warning in `profile.tsx`).
* `next build` — **Turbopack compiles successfully**; the build cannot finish in
  this sandbox because Next spawns helper processes and the sandbox denies
  `spawn`/`unlink` (EPERM). Run `bun run build` on a normal machine/CI.

## Not verified here (needs a real browser + Postgres)

* End-to-end flows: sign-in, chart switch, Acharya streaming, offline reload.
* Any timing numbers — `?perf=1` provides them, but they must be captured on
  the real device (startup, warm relaunch, tab round-trip).

## Deploy footprint

**No schema change, no migration.** The only API change is additive (`chartId`
in `/api/auth?chart=1`). Pushing to the connected GitHub branch is enough for
Render to rebuild and restart; see `DEPLOY.md`.

## Deliberately not done

* TanStack Query migration (installed but unused; rationale in `docs/CACHING.md` §8).
* Home single-summary endpoint (four independent freshness scopes today).
* Feature roadmap (D9/reports, dasha explorer, panchang calendar, family labels)
  and freemium entitlements — waves 3 and 4.
* True offline-first Android: Capacitor still loads the deployed URL.
