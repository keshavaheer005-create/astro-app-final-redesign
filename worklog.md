# Self Sage — Worklog

## Project
"Self Sage" — premium Vedic astrology + self-improvement app. AI persona: **Acharya Abhishek Sharma**.
Platform adaptation (mandated by environment): Next.js 16 App Router + TypeScript (single `/` route, SPA-style views) instead of Vite/Express; API routes under `src/app/api/*` (equivalent of the Express endpoints); Prisma + SQLite as built-in DB; sweph (Swiss Ephemeris native WASM/NAPI bindings) for calculations; react-i18next for i18n (en + hi); Tailwind 4 + shadcn/ui.

## Palette / Design tokens
- cream `#FAF7F0`, gold `#C9A227`→`#E8C568`, charcoal `#1A1A1A`, maroon `#6B2737`, ink `#2A2420`
- Glass cards: blur(20px) rgba(255,255,255,0.6), 1px gold border, @supports fallback
- Mandala line-art backdrop at low opacity; Playfair Display headings / Inter body; type scale 12/14/16/20/28; 4px spacing; 16px mobile / 24-32px desktop margins
- Floating pill bottom nav (mobile) / left sidebar (≥1024px) with sliding gold active pill

## Task assignments
- Task 0/1: foundation, deps, schema, design tokens — lead
- Task 2-r (subagent, general-purpose): research + encode Ashtakavarga BAV tables & matching Yoni/Vashya tables with strict validation
- Task 1-s (subagent, frontend-styling-expert): custom SVG icon set (1.5px gold stroke), logo, Acharya avatar, mandala backdrop, shell (nav + glass primitives + wheel/calendar pickers)
- Task 2 (lead): Swiss Ephemeris engine + validation + all API routes
- Task 3-a..3-d (subagents): screens (Onboarding+Profile / Kundli-Panchang-Horoscope / Matching+Reports / Journal+Acharya)
- Task 4-6 (lead): integration, lint, agent-browser QA, cron

## Work Log

---
Task ID: 0
Agent: lead
Task: Inspect scaffold, verify stack, plan build

Work Log:
- Inspected project: Next 16 + Tailwind 4 + shadcn/ui (full set in src/components/ui), Prisma SQLite present, framer-motion/zustand/i18n deps to add
- Installed: sweph@2.10.3 (Swiss Ephemeris, native prebuilds), i18next, react-i18next, astronomy-engine (cross-validation)
- Validated sweph under bun: JD calc, calc_ut (Sun J2000 tropical 280.369° ✓), Lahiri ayanamsa 23.857° ✓, houses (Sun≈MC at London noon ✓), rise_trans (Delhi sunrise 07:13 IST ✓). API shapes: calc_ut→{flag,error,data:[lon,lat,dist,lonSpd,...]}, houses→{data:{houses,points[8]}}, rise_trans(jd,ipl,'',epheflag,rsmi,geopos,atpress,attemp). Constants under `swe.constants.*` (SE_SIDM_LAHIRI etc.)

Stage Summary:
- Engine path confirmed: sweph + SEFLG_MOSEPH (no ephemeris files needed), Lahiri sidereal. Proceeding to schema + engine + design system.

---
Task ID: 2
Agent: lead
Task: Swiss Ephemeris engine + all API routes

Work Log:
- Built src/lib/astro/*: constants, ephemeris (sweph wrapper), chart builder, dasha (Vimshottari), varga (D1-D60), panchang (tithi/nakshatra/yoga/karana/rise-set/rahu-kaal), ashtakavarga (research-verified tables: totals 48/49/39/54/56/52/39=337 ✓), matching (8 kootas), doshas (Mangal+ Sade Sati), horoscope/gochara
- Fixed findIngress bug in sade sati; fixed ashtakavarga offset-row application
- Validation: planets cross-checked vs astronomy-engine (max err 0.0022°), asc vs spherical-trig formula (≤0.002°), sunrises within 2min, Vimshottari 120y ✓, ayanamsa ranges ✓
- API routes live & smoke-tested via dev server: /api/chart (computed+saved), /api/panchang (Jan 15 2024 Delhi: Shukla Panchami, P.Bhadrapada, Sun Capricorn ✓), /api/geocode (live Open-Meteo ✓ + 60-city offline fallback), /api/match (20.5/36 breakdown ✓), /api/auth (guest session cookie, scrypt upgrade), /api/charts, /api/checkins (+PATCH insights), /api/ask-acharya (LLM grounded in chart+journal), /api/weekly-reflection (lazy weekly gen), /api/decision-timing (real factors + 14-day window scan), /api/reminders, /api/horoscope (gochara structure)
- next.config: serverExternalPackages ["sweph"]

Stage Summary:
- Stage 1+2 COMPLETE with real data verified. Design tokens/globals.css + icons + primitives + pickers + shell + i18n base + store also landed (lead-built after agent infra timeouts). Next: all screens.

---
Task ID: 3-4-5
Agent: lead (all screens built lead-side after subagent infra timeouts)
Task: Frontend screens, integration, E2E QA

Work Log:
- Built i18n (en+hi, ~230 keys), session-context (8s hard bootstrap timeout + retry), app shell (floating pill bottom nav mobile / glass sidebar desktop, 250ms sliding gold indicator), pickers (wheel time, animated calendar), screens:
  - Onboarding: name → birth (calendar grid, 3 wheel spinners, debounced geocode autocomplete + use-my-location + reverse geocode, live confirmation line) → computing → ready
  - Home: greeting header, today's-panchang hero + Acharya ink CTA, daily check-in (mood/energy sliders + note, streak, dismisses when done), weekly letter ink card w/ progress, feature grid under 3 section headers
  - Kundli tab: chart (North/South SVG diagrams, Vedic/Western/Both + agreement line, planets table), Panchang (4 limbs + rise/set + Rahu kaal), Horoscope (D/W/M/Y gochara, ink headline card, transit grid), Matching (2-person form, use-my-details, 36-point breakdown, Mangal cards), Reports (dasha timeline + antars, D1-D60 vargas, SAV bars + BAV, Mangal + Sade Sati cards)
  - Journal: mood timeline SVG with dasha bands, pattern insight (real aggregates; 14-day encouraging gate), correlation narrative via LLM, history, Decision Timing dialog
  - Acharya: persisted chat, grounded LLM answers (verified: cites Mercury 1st house Chitra, Venus 11th), typing indicator, suggestions
  - Profile: saved charts (activate/delete), instant EN↔HI switch (verified across 3+ screens incl. chart glyphs), reminders, display prefs (reduce motion, high contrast), auth upgrade, export, about
- page.tsx orchestrator: splash w/ 8s timeout + retry, top-level error boundary, view routing

QA (agent-browser, mobile 375px + desktop 1440px):
- FIXED: i18n import path (500), dashaSnapshot import in checkins (500), sade-sati phase null, sunrise shown in viewer TZ (now chart TZ), LogoMark hydration float mismatch, matching place-input sync (render-adjust pattern)
- Verified flows: onboarding→chart compute→home; check-in save (streak 1→3); Acharya grounded answer; decision timing (verdict 57/100, real factors, Oct 2026 windows); weekly reflection auto-generated quoting user note verbatim; matching 20.5/36 Arjun×Diya; horoscope 27% transit support; dasha Ve/Ju highlighted; Hindi switch instant; console clean; lint 0 errors

Stage Summary:
- ALL 8 build stages complete and verified with real data. App is production-quality. Worklog current.

---
Task ID: review-1 (cron webDevReview round 1)
Agent: lead
Task: QA sweep + new features (Choghadiya/muhurtas, notification center, TTS letter playback) + styling detail pass

Work Log:
- QA: full tab sweep at 375px + 1280px via agent-browser — console clean, page 200, all prior flows stable
- FEATURE 1 — Muhurtas & Choghadiya (Panchang screen): classical 7-cycle day/night choghadiya (8 slots each from sunrise→sunset→next sunrise), quality coloring (Amrit/Shubh/Labh favorable · Char moderate · Udveg/Kaal/Rog caution), live "Now" slot ring-highlight (verified: 14:36 UTC correctly inside Amrit slot); Abhijit muhurta (8th of 15 day parts) + Brahma muhurta (96→48min before sunrise) cards
- FEATURE 2 — Notification center: bell now opens a glass popover with dynamic items (check-in due + reminder time, letter ready, streak milestone ≥3d, or all-quiet empty state)
- FEATURE 3 — TTS letter playback ("Listen" button on weekly letter): POST /api/reflection-audio → z-ai TTS (voice tongtong, speed 0.95), sentence-chunked <1024 chars, WAV PCM extraction + single RIFF header rewrite for smooth chunk merge, cached as data URI in WeeklyReflection.audioUrl (62s audio, 16s gen). FIXED: SDK named-import crash (default import), API rejects mp3 → wav
- BUG FIX: Journal empty-state button was a no-op → now navigates Home (onNavigate prop wired through page.tsx)
- STYLING: parametric MoonPhaseGlyph in hero (verified shows "Full moon" on Purnima ✓), gold drop-cap on letter body (.letter-body), shimmer skeletons replace pulse blocks, ascendant house highlighted in N/S charts (glow + ASC tag / gold cell), ink-card gold aura (radial ::after), ornament dividers between Home sections, planet tooltips on chart tags
- i18n: +26 keys (phases, choghadiya, muhurtas, notifications, listen/stop) en+hi

Stage Summary:
- Round 1 complete. Lint 0 errors. All new features browser-verified with real data.
- Known variance: choghadiya weekday START offsets differ between panchang software; ours matches the Sunday anchor (Udveg) + Mon/Sat/Thu anchors from AstroSage-style tables; cycle+qualities are Wikipedia-verified. Revisit if authoritative source found.
- Next suggestions: Acharya streaming responses, moonrise/moonset on Home, push-notification scheduling, matching result save/share, D-chart navamsa planetary detail table.

---
Task ID: review-2 (cron webDevReview round 2)
Agent: lead
Task: Status assessment + agent-browser QA + bug fixes + new features (streaming Acharya, moon data, D9 table, match history) + styling detail pass

Work Log:
- QA sweep (agent-browser, 375px + 1440px, all 5 tabs + sub-tabs): app stable, console clean, prior features intact
- BUG 1 (high): tapping "Dasha & Reports" panned the WHOLE page horizontally (body.scrollWidth 545 vs 375; scrollingElement.scrollLeft 164). Root cause: SlidingPillTabs rendered a non-wrapping flex row with no overflow container. FIX: strip is now its own scroll container (`overflow-x-auto no-scrollbar`), active tab auto-centers via scrollIntoView(inline:center, block:nearest); html/body get `overflow-x: clip` guard; added `.no-scrollbar` utility to globals.css
- BUG 2: React "cannot update a component while rendering another" (Providers→PanchangScreen/AppInner). Root cause: initI18n() called during Providers render. FIX: i18next init moved to module scope (zustand persist rehydrates synchronously so persisted language still applies pre-render); verified warnings gone after fresh reload
- Cleanup: Next.js devIndicators disabled (N badge overlapped mobile bottom nav); Chip gained `compact` prop (was silently ignored); removed invalid xmlns on div inside foreignObject; eslint fully clean (0 errors 0 warnings, incl. removing 3 stale unused-disable directives, one re-scoped with justification)
- FEATURE — Acharya streaming: SDK chat.completions supports stream:true (returns ReadableStream). ai.ts: acharyaSystem extracted; new acharyaStreamReply() parses upstream SSE tolerantly (delta.content/message.content/bare-text), re-emits `data: {"v":chunk}` wire SSE, returns {stream, done}; route persists user turn immediately + assistant turn when done resolves; client renders token-by-token with gold pulse cursor, thinking dots hide on first delta, falls back to non-stream JSON endpoint if SSE fails/empty. VERIFIED: mid-stream capture at t+1.5s with cursor visible; grounded answer (Mercury 1st Chitra, Saturn 9th Rohini, quoted journal Sept 24/25); message persisted after reload
- FEATURE — Moonrise/Moonset on Home hero: two new custom 1.5px gold icons (moonrise/moonset), i18n en+hi (चंद्रोदय/चंद्रास्त); hero now shows Sunrise · Moonrise · Moonset row. Verified both languages
- FEATURE — Varga planet detail table (Reports): for the selected divisional (D1–D60), a striped table lists planet | sign | house-in-varga; D9 adds a Vargottama badge column (D1 sign == D9 sign) + explanatory hint. Verified: D9 asc Virgo, Sun Sagittarius = house 4 ✓; i18n en+hi
- FEATURE — Matching history: last 6 matches in localStorage (`ss-match-history-v1`); RECENT MATCHES card under Match button shows names × / date / gold score pill; click restores both persons + full result instantly; Clear button. VERIFIED: computed Arjun×Diya 22.5/36, history survived reload, restore refills form + result
- STYLING: Kundli summary tiles — labels no longer truncate ("Ascendant" fully visible); Journal mood timeline — dasha band shows lord name (≥18% width) + "Dasha periods during these days" caption (was an unexplained gold bar)

Stage Summary:
- Round 2 complete: 1 UX bug + 1 React warning fixed, 4 features added, lint 0/0, tsc src-clean, all verified in browser at 375px & 1440px with real data (i18n parity 348 keys en+hi).
- Next candidates: TTS for Acharya replies, matching result share/export (Web Share API + PNG), Sade Sati personal timeline card, Panchang month-view tithi chips, per-checkin Acharya micro-note on Pattern dashboard.

---
Task ID: review-3 (cron webDevReview round 3)
Agent: lead
Task: Status assessment + agent-browser QA + bug fixes + new features (Acharya TTS per-message, Monthly Panchang, check-in micro-notes, match share) + styling detail pass

Work Log:
- QA sweep (agent-browser 375px + 1440px, all 5 tabs): app stable, console clean, all prior features intact
- BUG 1 (high): /api/reflection-audio had a syntax error — `Buffer.concat(eader, pcm])` (corrupted identifier) → route 500s on any uncached letter. FIX: extracted shared TTS engine to src/lib/tts.ts (chunkForTts ≤950-char sentence chunks, extractWavPcm, buildWav, synthesizeWav/DataUri) and rewrote the route on top of it. Verified: letter "Listen" plays, cached call 137ms
- FEATURE — Acharya reply TTS: new /api/acharya-audio (POST {messageId}) synthesizes+caches per-message WAV in ChatMessage.audioUrl (schema migrated); client adds a small Listen/Stop pill under every substantial assistant bubble, one-at-a-time playback, preparing-state; client temp id reconciled to the persisted DB id after streaming (content match against GET history) so fresh replies are listenable. VERIFIED: first gen 23.2s, cached replay 57ms, trusted-click plays (button → "Stop"); NOTE: eval-injected clicks are untrusted gestures so headless Chrome blocks audio autoplay — test with real agent-browser clicks
- FEATURE — Monthly Panchang: panchangFor lib gains lightweight daySummaryFor (tithi/nakshatra/sunrise only, no moonrise/choghadiya/crossings) + DaySummary type with special markers (purnima/amavasya/ekadashi); /api/panchang accepts {month:"YYYY-MM"} → 30-day scan (verified Sept 2026: Amavasya 9/10, Ekadashi 9/7+9/22, Purnima 9/26 = matches live home panchang); Panchang screen gets Day/Month segmented toggle (glass pill, gold active) + MonthGrid (7-col chips colored by paksha, gold purnima / maroon amavasya / sage ekadashi dots + glow, today ring, click-through to day view, prev/next month nav, legend). Fully localized en+hi. VERIFIED mobile 375px + desktop 1440px, Hindi labels (सितंबर 2026, रवि…शनि, पूर्णिमा)
- FEATURE — Per-check-in Acharya micro-note: DailyCheckIn.microNote (schema migrated); /api/checkins/micro-note (POST {id,language}) generates 1-2 sentence reflection via new ai.ts checkinMicroNote (grounded ONLY in that day's dasha snapshot + mood/energy/note, deterministic fallback), cached in DB; GET /api/checkins now returns microNote (was the reason notes didn't rehydrate — fixed); Journal history rows get "Acharya note" chip → shimmer skeleton → gold-bordered italic note. VERIFIED E2E: "With Jupiter in your antardasha bringing expansive energy to Venus's maha dasha, your Cancer moon found its rhythm in deep focus…" — cites real MD/AD, real moon sign, quotes the logged evening; survives reload (chip disappears, note persists)
- FEATURE — Matching share: custom 1.5px-stroke `share` icon added to icon set; result card gets "Share result" → Web Share API with clipboard fallback ("Copied ✓" feedback, 2.4s). Text summary: names, X/36, verdict, per-koota lines, "Swiss Ephemeris (Lahiri)" footer. VERIFIED: clipboard fallback fired in headless (Copied ✓ state)
- STYLING: ink-card sheen-sweep (slow 6.5s diagonal gold light band, transform-only) on Talk-to-Acharya CTA + weekly letter; flame-pulse heartbeat (2.4s, subtle rotate+scale) on all streak flames; gold focus-visible ring (:where(button,[role=tab],a,input…) — keyboard a11y); mood timeline gradient area fill under the line (gold fade); matching history rows + journal rows hover-border lifts; month chips active:scale-90 press feel
- i18n: +25 keys en+hi (acharya.listen/stopAudio/preparingAudio, panchang.mode.day|month/modeAria/purnima/amavasya/ekadashi/monthHint, common.previousMonth/nextMonth, weekdaysShort.0-6, journal.askNote/noteBy, match.share/shareCopied/shareTitle/shareFooter) — parity 373=373
- INFRA: dev-server restarts in this sandbox are killed at tool-call boundaries (session cgroup reaping) → QA batched per-call (restart + test in same call); final clean rebuild (rm -rf .next) done; a stale Turbopack parse-error after mid-edit hot reloads was resolved by touch+recompile (fresh builds from clean .next are clean)

Stage Summary:
- Round 3 complete: 1 real route-breaking bug fixed (TTS), 4 user-facing features shipped (per-message Acharya TTS, monthly panchang with classical day markers, grounded per-day micro-notes, match share), styling depth pass (sheen, flame heartbeat, focus rings, gradient fill, press states), i18n parity maintained. Lint 0/0, tsc src-clean, all verified in browser with real data at 375px + 1440px in both languages.
- Known risks: (a) per-call process reaping — if the preview shows the app down, the platform boot flow restarts `bun run dev` (start.sh); (b) TTS generation takes ~20s+ for long answers on first listen (cached afterwards); (c) eval-driven clicks can't autoplay audio in headless Chrome (not a product bug).
- Next candidates: Panchang month chips → festival/parva layer (Vinayaka Chaturthi etc. via tithi+nakshatra rules), Acharya voice replies (STT mic input) for hands-free journaling, Dasha-transition alert cards on Home ("Mercury dasha ends in 34 days"), export week letter as PDF/image, push-reminder scheduling via cron service, per-planet Ashtakavarga detail popovers.
