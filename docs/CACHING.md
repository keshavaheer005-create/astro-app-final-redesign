# Caching & client persistence

How Astrovia keeps data for speed, and the rules that make that safe. This is
the design the code in `src/lib/client-cache/`, `src/lib/api.ts` and
`src/components/astrovia/session-context.tsx` implements.

> **The one rule:** cache data for speed, never use cached data to prove
> authorization. Every session decision comes from the server.

---

## 1. The four caches (and what each is for)

| Cache | Lives in | Survives reload | Survives restart | Used for |
| --- | --- | --- | --- | --- |
| `memo()` — `src/lib/cache.ts` | Node process | n/a | no | Expensive pure astronomy per identical input (6 h TTL, keyed by birth input + UTC day); also the per-day transit ingress scan (12 h TTL) |
| SWR — `apiSWR()` | `localStorage`, `astrovia:swr:` | yes | yes | "Today" data: Panchang, sky highlights, Dasha-now, today's check-in, transits (`transits|<chartId>|<day>`, 6 h freshness) |
| Chart snapshots — `client-cache/charts.ts` | IndexedDB `charts` | yes | yes | The last server-confirmed computed chart per account + chart |
| Acharya history — `client-cache/chat.ts` | IndexedDB `chat` | yes | yes | Up to 40 recent confirmed turns per account + chart |

They do not overlap: the server memo never leaves the server, SWR holds
public/derived daily data, and the two IndexedDB stores hold private,
account-scoped data.

## 2. Key policy

```
charts/<userId>|<chartId>      → { userId, chartId, engineVersion, chart }
chat/<userId>|<chartId>        → { userId, chartId, messages[] }
localStorage: astrovia:swr:<userId>|<scope>|<url>|<body>
localStorage: astrovia:cache:account:v1  → userId only (switch detector)
```

* Keys contain **ids only** — never a birth date, time, place or coordinate.
* Every stored value also records `userId`/`chartId`; a read re-checks them, so
  even a key collision cannot return another account's data.
* `CACHE_SCHEMA_VERSION` (`client-cache/idb.ts`) invalidates everything when the
  stored *shape* changes; `CHART_ENGINE_VERSION` invalidates chart snapshots when
  the *calculation* changes. Both are checked on read and pruned on adoption.

## 3. Lifecycle

### Chart snapshot
1. Session bootstrap calls `/api/auth?chart=1`, which returns `user`, `chart` and
   `chartId` (ids only — no new columns, no migration).
2. The server response is painted and written to the snapshot store.
3. If the payload carries a `chartId` but no usable `chart` (unreadable blob),
   the snapshot for *that exact id* is painted instead of falling back to a
   blank/onboarding screen.
4. Switching charts (`activateChart`) paints the **target** chart's snapshot
   before the network round trip, and blanks the previous chart if the target has
   no snapshot — never a frame of the wrong profile's data.
5. `refreshChart()` writes whatever the server confirmed, replacing the old
   snapshot (so editing birth details invalidates the previous paint).

### Acharya history
1. On mount, the screen reads the snapshot for `(userId, chartId)` and paints it.
2. `/api/ask-acharya` is fetched in the background; the **server list replaces**
   the painted list and is re-cached.
3. A streamed reply is `pending` until the server returns its message id
   (`reconcileAssistantId`). Pending/streaming turns are **never persisted**, so
   an interrupted stream cannot become fake history.
4. The cached list is bounded to the newest 40 confirmed turns.

## 4. Purge points (all implemented)

| Event | Action | Code |
| --- | --- | --- |
| Sign out | Delete this account's charts + chat + SWR copies | `clearAccountCache(userId)` in `profile.tsx` |
| Different account signs in | Wipe previous account, then any foreign rows (`purgeForeignEntries`) | `adoptAccount()` in `session-context.tsx` |
| Chart deleted | Delete that chart's snapshot (server cascades its chat) | `forgetChartSnapshot(id)` in `profile.tsx` |
| Chart edited | The server returns the recomputed chart, which replaces this chart's snapshot | `/api/charts` PUT + `refreshChart` |
| "Delete all my data" | Full device purge after the server confirms | `clearAllClientCaches()` in `profile.tsx` |
| Build changes schema/engine | Version mismatch → entry ignored and deleted | `readEnvelope`, `pruneStaleSnapshots` |
| User clears device copies | Full device purge | "Clear device copies" in Profile |

## 5. What is never cached

* Cookies, access tokens, Supabase sessions — the session cookie is `httpOnly`
  and server-signed; nothing about it is written to storage by the client cache.
* Authorization decisions ("this user may read this chart") — never inferred
  from a cache hit. A cached chart is only painted after `/api/auth` confirms the
  account, and only for a `chartId` the server also returned.
* Unconfirmed streaming replies.
* Any personal data in shared/CDN caches: `/api/auth` and `/api/charts` respond
  with `Cache-Control: private, no-store`.

## 6. Guardrails for the "wrong person" case

* No chart is painted on a cold start until the server has answered who the user
  is. There is deliberately **no offline chart unlock** — a separate, explicit
  local-unlock design would be required for that (see §8).
* Switching accounts purges rather than reuses.
* Chart switching never reuses the previous chart's React state: the screen tree
  is keyed by the active chart's birth input (`page.tsx`), and `activateChart`
  clears the old chart before the new one resolves.

## 7. Measuring it

`src/lib/perf.ts` records bounded timings and counters. Enable verbose logging by
opening the app with `?perf=1` (or `localStorage.setItem('astrovia:perf','1')`).
Then read:

```js
window.__astroviaPerf.snapshot()   // entries + counters
window.__astroviaPerf.report()     // console summary table
```

Recorded metrics:

* `bootstrap.auth`, `bootstrap.total` (with `fromCache`)
* `chart.cachePaint` / `cache.chart.hit|miss`
* `acharya.cachePaint`, `acharya.network`, `cache.chat.hit|miss`
* `nav.commit` — tab-switch commit latency
* `api.request`, `api.request <route>`, `api.dedupe`, `api.slow(>=150ms)`, `api.fetch.slow`
* `cache.swr.hit|miss|fresh-skip`

Take the numbers on a cold launch, a warm relaunch and a tab round-trip, on web
and Android, before and after a change.

## 8. Deliberate decisions

**No TanStack Query migration yet.** `@tanstack/react-query` is installed but
unused (audited). Wiring it in would mean rewriting every screen's data flow in
the same change that introduces on-device persistence. Instead
`client-cache/` is the single owner of *persisted* private data, with explicit
keys and purge points, and `apiSWR` handles "today" data. A future change can
wrap these primitives in `useQuery` without changing the storage contract.

**Not offline-first.** `capacitor.config.ts` loads the deployed site, so these
caches make previously loaded data appear instantly but do not make Android work
without a network. A true offline launch needs a bundled shell, an
offline-capable auth story and a designed local-unlock policy for charts.

**Home keeps four requests.** Panchang, sky highlights, dasha and check-ins have
different freshness scopes and are already cached independently; merging them
into one summary endpoint would couple their invalidation. Revisit the merge
only if measurements show request count (not payload or recompute) is the
bottleneck.

## 9. Deploying this change

**No database migration is required.** The client cache is versioned on the
client (`CACHE_SCHEMA_VERSION`, `CHART_ENGINE_VERSION`), and the only API change
is additive (`chartId` in the `/api/auth?chart=1` response). A GitHub push that
Render auto-deploys is enough — see `DEPLOY.md` at the repo root.

1. Set a strong `SESSION_SECRET` (32+ random chars). Render's Blueprint
   generates one; **production now refuses to boot without it** (escape hatch
   for throwaway demos: `ASTROVIA_ALLOW_INSECURE_SESSION_SECRET=1`).
2. Existing sessions are **upgraded** transparently (old cookies are re-signed
   in the new expiring format). Nobody is logged out by this change; rotating
   `SESSION_SECRET` signs everyone out by design.
3. `bun run check` (typecheck + unit tests + lint) must pass; CI runs the same.
4. After the deploy, check `/api` — it reports `db`, `migrated`,
   `sessionSecret` and `supabaseKeys` as booleans.

## 10. Definition of done for this wave

* [x] Returning to a loaded Kundli does not recompute or refetch the chart.
* [x] Revisiting Home/Acharya uses cached state (`freshMs`, snapshot paint).
* [x] Changing the active family chart never shows the previous chart's data.
* [x] Sign-out / account switch cannot expose the previous user's chart or chat.
* [x] A chart edit replaces that chart's snapshot before it can be repainted.
* [x] AI streaming interruptions cannot create fake history (pending flag).
* [x] Private API responses are `private, no-store`.
* [x] Missing/expired auth cannot be bypassed through the local cache.
* [x] Type-check + regression tests are gates (`bun run check`, CI).
* [x] Deploying needs no schema change (push to GitHub is enough).

Covered by `tests/unit/chart-cache.test.ts`, `chat-cache.test.ts`,
`session-token.test.ts`, `env-and-account.test.ts`.
