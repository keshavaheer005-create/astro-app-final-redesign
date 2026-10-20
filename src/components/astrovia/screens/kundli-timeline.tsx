'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons';
import {
  Chip,
  EmptyState,
  ErrorState,
  GhostButton,
  GlassCard,
  PageLoader,
  ProgressBar,
  SectionHeader,
} from '../ui-primitives';
import { apiSWR } from '@/lib/api';
import { useSession } from '../session-context';
import { useAppStore } from '@/store/app';
import { SIGNS, SIGNS_HI, type PlanetKey } from '@/lib/astro/constants';
import { activeIndex, pratyantarsFor, type DashaPeriod } from '@/lib/astro/pratyantardasha';
import { daysSince, daysUntil, pctBetween, todayIso } from '@/lib/dates';
import { count, end, start } from '@/lib/perf';
import { cn } from '@/lib/utils';
import { AskAIAction } from '../ask-ai-action';

interface TransitPosition {
  key: PlanetKey;
  sign: number;
  degInSign: number;
  retrograde: boolean;
  houseFromLagna: number | null;
  houseFromMoon: number;
  benefic: boolean;
  note: 'support' | 'mixed' | 'pressure';
}

interface Ingress {
  key: PlanetKey;
  intoSign: number;
  at: string;
  daysUntil: number;
}

interface TransitsPayload {
  asOf: string;
  chartId?: string;
  positions: TransitPosition[];
  ingresses: Ingress[];
}

type Level = 'maha' | 'antar' | 'pratyantar';

/** Stored mahadasha row: a period plus its nine antardashas. */
interface MahaPeriod extends DashaPeriod {
  years: number;
  antardashas: DashaPeriod[];
}

interface UpcomingEvent {
  id: string;
  kind: 'antar' | 'pratyantar' | 'ingress';
  lord?: PlanetKey;
  ingress?: Ingress;
  at: string;
  days: number;
}

const TRANSIT_SWR_FRESH_MS = 6 * 60 * 60 * 1000;

export function TimelineScreen() {
  const { t, i18n } = useTranslation();
  const { chart, activeChartId } = useSession();
  const language = useAppStore((s) => s.language);
  const hi = i18n.language === 'hi' || language === 'hi';

  const [level, setLevel] = useState<Level>('antar');
  const [focusMaha, setFocusMaha] = useState<number | null>(null);
  const [focusAntar, setFocusAntar] = useState<number | null>(null);

  const [transits, setTransits] = useState<TransitsPayload | null>(null);
  const [transitsError, setTransitsError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const today = todayIso();

  // ── Dasha tree (already in the cached chart; no extra request) ────────────
  const mahadashas = (chart?.dashas?.mahadashas ?? []) as MahaPeriod[];
  const curMahaIdx = activeIndex(mahadashas, today);
  const mahaIdx = curMahaIdx >= 0 ? curMahaIdx : 0;
  const curMaha = mahadashas[mahaIdx];
  const antars = (curMaha?.antardashas ?? []) as DashaPeriod[];
  const curAntarIdx = activeIndex(antars, today);
  const antarIdx = curAntarIdx >= 0 ? curAntarIdx : 0;
  const curAntar = antars[antarIdx];
  // Plain calls, no useMemo: these are nine-element loops, and the React
  // Compiler memoises the render itself (manual memoisation here only fights it).
  const pratyantars = curAntar ? pratyantarsFor(curAntar) : [];
  const curPratyantarIdx = activeIndex(pratyantars, today);
  const curPratyantar = curPratyantarIdx >= 0 ? pratyantars[curPratyantarIdx] : pratyantars[0];

  // ── Drill-down selection (null = follow "now") ────────────────────────────
  const focusMahaIdx = focusMaha ?? mahaIdx;
  const focusAntarIdx = focusAntar ?? (focusMaha === null ? antarIdx : 0);
  const focusMahaObj = mahadashas[focusMahaIdx];
  const focusAntarObj = (focusMahaObj?.antardashas ?? [])[focusAntarIdx] as DashaPeriod | undefined;
  const focusPratyantars = focusAntarObj ? pratyantarsFor(focusAntarObj) : [];

  // ── Transits (one cached request per chart per day) ───────────────────────
  useEffect(() => {
    if (!chart || !activeChartId) return;
    let cancelled = false;
    let painted = false;
    const t0 = start();
    void apiSWR<TransitsPayload>(
      '/api/transits',
      undefined,
      // Account prefix is added by apiSWR; chart id + day keep it isolated.
      `transits|${activeChartId}|${todayIso()}`,
      (res) => {
        if (cancelled) return;
        setTransits(res);
        setTransitsError(false);
        if (!painted) {
          painted = true;
          count('cache.transits.paint');
          end('timeline.firstPaint', t0);
        }
      },
      () => cancelled,
      { freshMs: TRANSIT_SWR_FRESH_MS, onError: () => setTransitsError(true) },
    );
    return () => {
      cancelled = true;
    };
  }, [chart, activeChartId, reloadKey]);

  // ── Upcoming: dasha boundaries + slow-graha ingresses, merged ─────────────
  let upcoming: UpcomingEvent[] = [];
  {
    const events: UpcomingEvent[] = [];
    if (curAntar) {
      const nextAntar = antars[antarIdx + 1];
      if (nextAntar) {
        events.push({
          id: `antar-${nextAntar.start}`,
          kind: 'antar',
          lord: nextAntar.lord,
          at: nextAntar.start,
          days: daysUntil(nextAntar.start),
        });
      }
    }
    if (curPratyantar) {
      const nextPratyantar = pratyantars[curPratyantarIdx + 1];
      if (nextPratyantar) {
        events.push({
          id: `pratyantar-${nextPratyantar.start}`,
          kind: 'pratyantar',
          lord: nextPratyantar.lord,
          at: nextPratyantar.start,
          days: daysUntil(nextPratyantar.start),
        });
      }
    }
    for (const ing of transits?.ingresses ?? []) {
      events.push({ id: `ingress-${ing.key}-${ing.at}`, kind: 'ingress', ingress: ing, at: ing.at, days: ing.daysUntil });
    }
    upcoming = events
      .filter((e) => e.days >= 0)
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(0, 3);
  }

  if (!chart) {
    return <EmptyState icon="timeline" title={t('home.noChart')} body={t('home.noChartBody')} />;
  }
  if (mahadashas.length === 0) {
    return <EmptyState icon="timeline" title={t('timeline.noDasha')} body={t('timeline.noDashaHint')} />;
  }

  const signName = (idx: number) => (hi ? SIGNS_HI[idx] : SIGNS[idx]);
  const planetName = (key: PlanetKey | undefined) => (key ? t(`planet.${key}`) : '—');

  /** One row of the "where you are now" ladder. */
  const ladderRow = (labelKey: string, lord: PlanetKey | undefined, startIso?: string, endIso?: string) => {
    if (!lord) return null;
    const pct = startIso && endIso ? pctBetween(startIso, endIso) : 0;
    const remaining = endIso ? daysUntil(endIso) : null;
    return (
      <div className="rounded-2xl bg-white/65 shadow-[0_2px_10px_rgba(110,74,158,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-t12 uppercase tracking-wide text-violet-deep font-semibold">{t(labelKey)}</span>
          {remaining !== null && (
            <span className="text-t12 text-muted-foreground tabular-nums">
              {remaining <= 0 ? t('dasha.endsToday') : t('timeline.endsIn', { n: remaining })}
            </span>
          )}
        </div>
        <p className="mt-1 font-serif text-t20 font-semibold text-charcoal">{planetName(lord)}</p>
        {startIso && endIso && (
          <p className="text-t12 text-muted-foreground tabular-nums">
            {startIso} → {endIso}
          </p>
        )}
        <ProgressBar value={pct} className="mt-2" />
        <AskAIAction
          compact
          className="mt-2"
          label={t('ai.explain')}
          question={`Explain my current ${t(labelKey)} period ruled by ${planetName(lord)} (${startIso ?? 'start date unavailable'} to ${endIso ?? 'end date unavailable'}). Use my saved chart, relevant houses/lordships, dignity, current antardasha and transits when available. Keep the interpretation practical, non-deterministic and grounded in verified placements.`}
        />
      </div>
    );
  };

  const levelTabs: { id: Level; labelKey: string }[] = [
    { id: 'maha', labelKey: 'timeline.level.maha' },
    { id: 'antar', labelKey: 'timeline.level.antar' },
    { id: 'pratyantar', labelKey: 'timeline.level.pratyantar' },
  ];

  const listForLevel: DashaPeriod[] =
    level === 'maha' ? mahadashas : level === 'antar' ? (focusMahaObj?.antardashas ?? []) : focusPratyantars;
  const currentInLevel =
    level === 'maha' ? mahadashas[mahaIdx] : level === 'antar' ? curAntar : curPratyantar;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-t28 font-bold text-violet-grad">{t('timeline.title')}</h1>
        <p className="text-t14 text-muted-foreground">
          {chart.input.name} · {t('timeline.today', { date: today })}
        </p>
      </header>

      {/* ── Where you are now ── */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('timeline.current')} icon="clock" />
        <div className="grid gap-2.5 sm:grid-cols-3">
          {ladderRow('timeline.level.maha', curMaha?.lord, curMaha?.start, curMaha?.end)}
          {ladderRow('timeline.level.antar', curAntar?.lord, curAntar?.start, curAntar?.end)}
          {ladderRow('timeline.level.pratyantar', curPratyantar?.lord, curPratyantar?.start, curPratyantar?.end)}
        </div>
        {curPratyantar && curAntar && (
          <p className="mt-3 text-t12 text-muted-foreground">
            {t('timeline.hint', {
              maha: planetName(curMaha?.lord),
              antar: planetName(curAntar.lord),
              pratyantar: planetName(curPratyantar.lord),
            })}
          </p>
        )}
      </GlassCard>

      {/* ── Timeline ── */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('timeline.periods')} icon="timeline" />
        <div className="flex gap-1.5 flex-wrap mb-3">
          {levelTabs.map((tab) => (
            <Chip
              key={tab.id}
              active={level === tab.id}
              onClick={() => {
                setLevel(tab.id);
                // Drilling always starts from the period you are looking at.
                if (tab.id === 'maha') {
                  setFocusMaha(null);
                  setFocusAntar(null);
                }
              }}
            >
              {t(tab.labelKey)}
            </Chip>
          ))}
        </div>

        <p className="text-t12 text-muted-foreground mb-2">
          {level === 'pratyantar' && focusAntarObj
            ? t('timeline.within', {
                lord: planetName(focusAntarObj.lord),
                range: `${focusAntarObj.start} → ${focusAntarObj.end}`,
              })
            : level === 'antar' && focusMahaObj
              ? t('timeline.within', {
                  lord: planetName(focusMahaObj.lord),
                  range: `${focusMahaObj.start} → ${focusMahaObj.end}`,
                })
              : t('timeline.tapHint')}
        </p>

        <div className="flex gap-2 overflow-x-auto scroll-slim pb-2 -mx-1 px-1">
          {listForLevel.map((period, idx) => {
            const isCurrent = currentInLevel?.start === period.start && currentInLevel?.lord === period.lord;
            const isPast = period.end <= today;
            return (
              <button
                key={`${period.lord}-${period.start}`}
                type="button"
                onClick={() => {
                  if (level === 'maha') {
                    setFocusMaha(idx);
                    setFocusAntar(null);
                    setLevel('antar');
                  } else if (level === 'antar') {
                    setFocusAntar(idx);
                    setLevel('pratyantar');
                  }
                }}
                className={cn(
                  'shrink-0 rounded-xl border px-3 py-2.5 min-w-[124px] text-left transition-all duration-200 active:scale-[0.98]',
                  isCurrent
                    ? 'glass border-violet/40 shadow-sm'
                    : isPast
                      ? 'bg-white/35 border-gold/10 opacity-60'
                      : 'bg-white/60 border-gold/20 hover:border-violet/30',
                )}
              >
                <span className={cn('flex items-center gap-1.5 text-t14 font-semibold', isCurrent ? 'text-violet-deep' : 'text-charcoal')}>
                  {planetName(period.lord)}
                  {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-violet animate-pulse" aria-hidden />}
                </span>
                <span className="block text-t12 text-muted-foreground tabular-nums">{period.start}</span>
                <span className="block text-t12 text-muted-foreground tabular-nums">→ {period.end}</span>
                {isCurrent && <ProgressBar value={pctBetween(period.start, period.end)} className="mt-1.5" />}
              </button>
            );
          })}
        </div>
        {level !== 'pratyantar' && (
          <p className="mt-1 text-t12 text-muted-foreground/80">{t('timeline.drillHint')}</p>
        )}
      </GlassCard>

      {/* ── Upcoming ── */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('timeline.upcoming')} icon="trending" />
        {upcoming.length === 0 ? (
          <p className="text-t12 text-muted-foreground">{t('timeline.upcomingEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5 rounded-xl bg-white/60 shadow-[0_1px_4px_rgba(42,36,32,0.03),inset_0_1px_0_rgba(255,255,255,0.8)] px-3 py-2">
                <Icon
                  name={e.kind === 'ingress' ? 'planet' : 'clock'}
                  size={15}
                  className={cn('mt-0.5 shrink-0', e.kind === 'ingress' ? 'text-gold' : 'text-violet')}
                />
                <div className="min-w-0">
                  <p className="text-t14 text-charcoal">
                    {e.kind === 'ingress' && e.ingress
                      ? t('timeline.event.ingress', {
                          planet: planetName(e.ingress.key),
                          sign: signName(e.ingress.intoSign),
                        })
                      : t(e.kind === 'antar' ? 'timeline.event.antar' : 'timeline.event.pratyantar', {
                          lord: planetName(e.lord),
                        })}
                  </p>
                  <p className="text-t12 text-muted-foreground tabular-nums">
                    {e.at} · {e.days <= 0 ? t('common.today') : t('timeline.inDays', { n: e.days })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {/* ── Transits today ── */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('timeline.transits')} icon="planet" />
        <p className="text-t12 text-muted-foreground mb-3">{t('timeline.transitsHint')}</p>

        {!transits && !transitsError && <PageLoader label={t('common.calculating')} />}
        {!transits && transitsError && (
          <ErrorState
            message={t('common.networkError')}
            onRetry={() => {
              setTransitsError(false);
              setReloadKey((n) => n + 1);
            }}
          />
        )}
        {transitsError && transits && (
          <GhostButton
            className="mb-2 h-8 px-3 text-t12"
            onClick={() => {
              setTransitsError(false);
              setReloadKey((n) => n + 1);
            }}
          >
            <Icon name="refresh" size={13} /> {t('common.refresh')}
          </GhostButton>
        )}

        {transits && (
          <ul className="space-y-1.5">
            {transits.positions.map((p) => (
              <li
                key={p.key}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2',
                  p.note === 'support'
                    ? 'bg-emerald-faint/70 border-emerald/25'
                    : p.note === 'pressure'
                      ? 'bg-burgundy-soft/70 border-burgundy/25'
                      : 'bg-white/55 border-gold/15',
                )}
              >
                <span className="w-16 shrink-0 text-t14 font-semibold text-charcoal">{planetName(p.key)}</span>
                <span className="min-w-0 flex-1 text-t12 text-charcoal/85">
                  {signName(p.sign)} {p.degInSign.toFixed(1)}°
                  {p.retrograde && (
                    <span className="ml-1.5 rounded-full bg-burgundy/12 px-1.5 py-0.5 text-[10px] font-semibold text-burgundy align-middle">
                      {t('timeline.retro')}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right text-t12 text-muted-foreground tabular-nums">
                  <span className="block">{t('timeline.houseLagna', { n: p.houseFromLagna ?? '—' })}</span>
                  <span className="block">{t('timeline.houseMoon', { n: p.houseFromMoon })}</span>
                </span>
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    p.note === 'support' ? 'bg-emerald' : p.note === 'pressure' ? 'bg-burgundy' : 'bg-gold/60',
                  )}
                  aria-hidden
                />
              </li>
            ))}
          </ul>
        )}
        {transits && (
          <AskAIAction
            className="mt-3"
            compact
            label={t('ai.explain')}
            question={`Explain my current planetary transits in a chart-grounded way. Current transits: ${transits.positions.map((p) => `${planetName(p.key)} in ${signName(p.sign)} ${p.degInSign.toFixed(1)} degrees; house from Lagna ${p.houseFromLagna ?? 'unavailable'}, from Moon ${p.houseFromMoon}; tone ${p.note}${p.retrograde ? ', retrograde' : ''}`).join('; ')}. Connect only the most relevant transits to my natal placements and current dasha; do not invent aspects or promise outcomes.`}
          />
        )}
      </GlassCard>
    </div>
  );
}
