# Timeline (dasha + gochar) and Quick Tools

Two additions that make the app useful on a *repeat* visit: a screen that answers
"where am I in time, and what is coming next", and a Home strip the user can
arrange themselves.

---

## 1. Timeline (Kundli → Timeline)

A sixth Kundli sub-view (`KundliView = 'timeline'`) rendered by
`src/components/astrovia/screens/kundli-timeline.tsx`.

### What it shows

| Block | Source |
| --- | --- |
| Where you are now — mahadasha / antardasha / pratyantardasha, with progress | `chart.dashas` (stored snapshot) + `pratyantarsFor()` |
| Period timeline with drill-down and a "now" marker | same |
| Coming up — next 3 dated events | period ends from the chart + `/api/transits` ingresses |
| Transits today — 9 grahas: sign, degree, retrograde, house from Lagna, house from Moon, benefic/pressure | `/api/transits` |

### Pratyantardasha without a migration

The engine (`src/lib/astro/dasha.ts`) stores only mahadasha and antardasha
periods. Level 3 is derived **on the client** in
`src/lib/astro/pratyantardasha.ts`:

```
subPeriod(lord) = antardashaLength × DASHA_YEARS[lord] / 120
```

The ratio is applied to the **stored** antardasha length, not to theoretical
years, so the last pratyantardasha ends exactly on the stored antardasha end.
Consequences:

* charts already in the database keep working — nothing is recomputed;
* no API change, no schema change, no migration;
* the maths is a pure function covered by `tests/unit/pratyantardasha.test.ts`.

### Ingress scanning

`src/lib/astro/transit-scan.ts` answers "when does Saturn change sign?".

* Coarse pass in 10/15/30-day steps, then a day-by-day bisection — a retrograde
  loop naturally returns the **first** crossing, not a later one.
* Only slow grahas are scanned (Saturn 12y window, Jupiter 2y, Rahu 2y). Full
  scan measured at **~89 ms** for all three.
* The scan takes a `positionAt(date)` callback, so it is unit-tested with
  synthetic motion and never needs the native Swiss Ephemeris in tests.
* Ingresses do not depend on the birth chart, so `/api/transits` memoises them
  per UTC day (`memo('transits|ingress|<day>', 12h)`) and shares them across all
  users of the process.

### `/api/transits`

`GET` only — reads the **active saved chart** server-side (same privacy shape as
`/api/dasha-now`); birth details never travel in the request.

```json
{
  "asOf": "2026-10-19T07:12:13.590Z",
  "chartId": "…",
  "positions": [{ "key": "Sa", "sign": 11, "degInSign": 15.93, "retrograde": true,
                  "houseFromLagna": 9, "houseFromMoon": 12, "benefic": false, "note": "pressure" }],
  "ingresses": [{ "key": "Ju", "intoSign": 4, "at": "2026-10-31", "daysUntil": 12 }]
}
```

* `Cache-Control: private, max-age=900`; the client keeps an SWR copy for 6 h
  (`freshMs`), so a revisit inside that window costs **zero** requests.
* Prefers the stored `chartData` JSON; falls back to `computeChartCached()` only
  when the snapshot is unusable.
* Verified against the real ephemeris on 2026-10-19: Sun 1.69° Libra, Saturn
  15.93° Pisces (R), Jupiter 28.37° Cancer → Leo on 2026-10-31 (12 days), Rahu
  2.51° Aquarius → Capricorn on 2026-12-06.

### Reports screen

The old dasha card (maha chips + current antars) was replaced by a compact
"current period" summary with an **Open timeline →** button. Static analysis
(vargas, ashtakavarga, doshas) stays in Reports; time lives in Timeline.

## 2. Quick Tools (Home)

`src/lib/quick-tools.ts` is the single catalogue. Each entry is a **navigation
target that already exists** — `{ id, icon, labelKey, bodyKey, tab, view }` —
so a shortcut can never trigger a request by being on screen.

* Persisted per device in zustand (`store/app.ts` → `quickTools`), included in
  `partialize`. No schema, no server state, no cross-device sync yet.
* `normalizeToolIds()` runs on every read and write: unknown ids (from a removed
  tool), duplicates and over-long lists are repaired; an empty list falls back
  to the defaults. The strip can never be blank.
* Four per row (`TOOLS_PER_ROW`), up to eight (`MAX_TOOLS`) → a second row
  appears at five.
* Editor: `quick-tools-sheet.tsx` — a bottom sheet with drag-and-drop
  (`@dnd-kit`, previously an unused dependency) **plus** move-up / move-down
  buttons and a remove button per row, because drag alone is unusable with a
  keyboard or a screen reader. The drag handle is a dedicated grip so vertical
  dragging never fights the sheet's scroll.

Default order is unchanged from the old hard-coded strip:
Acharya · Panchang · Decision Timing · Journal.

## 3. i18n

All new strings exist in both `en.json` and `hi.json`. `tests/unit/i18n-parity.test.ts`
fails if the key sets diverge, if a translation is blank, or if an
`{{placeholder}}` differs between locales — so the bilingual UI cannot silently
regress to raw keys.

Hindi labels: Timeline = दशा-गोचर, Antardasha = अंतर्दशा, Pratyantardasha =
प्रत्यंतर्दशा, Ingress = राशि परिवर्तन (`{{planet}} {{sign}} में प्रवेश`).

## 4. Performance

| Action | Cost |
| --- | --- |
| Open Timeline, first time today | 1 request (`/api/transits`, ~90 ms scan, memoised per day) |
| Open Timeline again within 6 h | 0 requests (SWR `freshMs`) |
| Drill maha → antar → pratyantar | 0 requests (client-side arithmetic) |
| Quick Tools tap | 0 requests (navigation only) |

Perf marks: `timeline.firstPaint`, `timeline.network`, counter
`cache.transits.paint`.

## 5. Tests

| File | Covers |
| --- | --- |
| `tests/unit/pratyantardasha.test.ts` | 9 sub-periods, contiguity, 120-year proportion, half-open "current" match, invalid input |
| `tests/unit/transit-scan.test.ts` | steady motion, no-change window, retrograde loop returns first crossing, 359°→0° wrap |
| `tests/unit/quick-tools.test.ts` | catalogue integrity, normalize/toggle/move rules, cap, never-empty |
| `tests/unit/i18n-parity.test.ts` | key parity, no blanks, matching placeholders |

## 6. Deliberately not included

* Interpretive report text, PDF export, yoga/dosha catalogue.
* Family relation labels (needs a `BirthChart.relation` column → migration →
  a separate, explicitly planned deploy step).
* Pratyantardasha on the server (would force a chart recompute for every stored
  chart; the client already has everything it needs).
* Push reminders for ingress dates.
