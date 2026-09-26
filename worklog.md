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
