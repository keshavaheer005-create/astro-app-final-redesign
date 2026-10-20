# Stage 3 — Predictive astrology foundation

## Scope

Stage 3 adds a transparent, deterministic rule layer over the project's existing chart, Vimshottari dasha, divisional-chart, transit and Ashtakavarga calculations. It does **not** replace the Swiss Ephemeris wrapper or claim that astrological rules guarantee real-world outcomes.

## Main modules

- `src/lib/astro/prediction-engine.ts`
  - `buildPredictiveOutlook()` evaluates six themes (career, relationships, wealth, learning, home and wellbeing) using active dasha lords, relevant natal-house lords, sign dignity, selected whole-sign transit aspects and relevant divisional-chart anchors.
  - Classical SAV bindus are considered only when the chart marks Ashtakavarga as non-approximate. Approximate fallback values are never presented as classical evidence.
  - `classifyDecisionTopic()` maps English/Hindi question keywords to a life-area theme.
  - `findDecisionWindows()` ranks up to three separated **day-level** candidates in the next 21 local calendar days using a local-noon sample, Moon gochara, selected nakshatras/tithis and classical SAV when available. This is a relative traditional fit, not an exact muhurta or a probability of success.
  - `predictiveContextLine()` adds a compact, evidence-labelled context block to Acharya instead of sending a second large context payload.
- `src/app/api/predictive-outlook/route.ts`
  - Authenticated, chart-scoped read endpoint; uses the existing chart cache and process-local TTL memoization. It makes no LLM call.
- `src/app/api/decision-timing/route.ts`
  - Reuses the same outlook/theme evidence and memoizes the day scan per active chart, local day and inferred topic.
- `src/components/astrovia/predictive-outlook-card.tsx`
  - Home card for the six themes, expandable evidence and an `AskAIAction` prompt to the existing Acharya chat.
- `src/lib/astro/chart.ts`
  - Shares one current-transit snapshot for the compact Acharya context, avoiding repeated ephemeris calculations within the same request.

## Interpretation and safety

- Theme tones are qualitative summaries of emitted rule signals, not outcome labels.
- The decision-timing numeric value is labelled a **traditional alignment index**, not a success percentage.
- Acharya is instructed not to invent placements, to distinguish tradition from certainty and to encourage practical evidence and user judgement.
- Dates returned by the decision scanner are local-calendar days sampled at noon. If a user needs an exact ceremony/travel/medical/legal/business time, this feature should not be used as a substitute for a domain-appropriate professional or a dedicated muhurta calculation.

## Verification

`tests/unit/prediction-engine.test.ts` covers topic classification, house mappings, dasha/transit signals, the classical-SAV guard and the caveat in the compact AI context. Syntax, JSON parsing and EN/HI key/interpolation parity checks passed during this implementation. The full Next.js typecheck/build and Bun test suite still need to be run in an environment with the project's dependencies installed.
