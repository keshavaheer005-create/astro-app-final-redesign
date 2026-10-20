'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Icon, type IconName } from './icons';
import { GlassCard } from './ui-primitives';
import { AskAIAction } from './ask-ai-action';
import { apiSWR } from '@/lib/api';
import { SIGNS, SIGNS_HI } from '@/lib/astro/constants';
import type { PredictiveOutlook, PredictionSignal, PredictionThemeId, ThemeOutlook } from '@/lib/astro/prediction-engine';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app';

const THEME_ICONS: Record<PredictionThemeId, IconName> = {
  career: 'trending',
  relationships: 'heart',
  wealth: 'star',
  learning: 'book',
  home: 'home',
  wellbeing: 'sun',
};

function signalText(signal: PredictionSignal, language: string, t: TFunction): string {
  const planet = signal.planet ? t(`planet.${signal.planet}`) : '';
  const dignity = signal.dignity ? t(`prediction.dignity.${signal.dignity}`) : '';
  const signs = language === 'hi' ? SIGNS_HI : SIGNS;
  const sign = typeof signal.sign === 'number' ? signs[signal.sign] : '';
  return String(t(`prediction.signal.${signal.code}`, {
    planet,
    house: signal.house ?? '',
    dignity,
    bindus: signal.bindus ?? '',
    varga: signal.varga ?? '',
    sign,
  }));
}

export function PredictiveOutlookCard({ chartId, timezone }: { chartId: string | null; timezone: string }) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const [outlook, setOutlook] = useState<PredictiveOutlook | null>(null);
  const [expanded, setExpanded] = useState<PredictionThemeId | null>(null);
  const [showAll, setShowAll] = useState(false);
  const todayKey = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
      return `${part('year')}-${part('month')}-${part('day')}`;
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }, [timezone]);

  useEffect(() => {
    if (!chartId) {
      setOutlook(null);
      return;
    }
    let cancelled = false;
    void apiSWR<{ outlook: PredictiveOutlook }>(
      '/api/predictive-outlook',
      undefined,
      `predictive-v1|${chartId}|${todayKey}`,
      (result) => { if (!cancelled) setOutlook(result.outlook); },
      () => cancelled,
      { freshMs: 20 * 60 * 1000 },
    );
    return () => { cancelled = true; };
  }, [chartId, todayKey]);

  if (!outlook) return null;

  const visibleThemes = showAll ? outlook.themes : outlook.themes.slice(0, 4);
  const chosen = expanded ? outlook.themes.find((theme) => theme.id === expanded) : undefined;
  const activeDasha = [outlook.dasha.mahaLord, outlook.dasha.antarLord].filter(Boolean).map((lord) => t(`planet.${lord}`)).join(' / ') || t('prediction.dashaUnavailable');

  const promptFor = (theme: ThemeOutlook) => {
    const signals = theme.signals.map((signal) => signalText(signal, language, t)).filter(Boolean);
    return `Explain my ${theme.id} theme in traditional Vedic astrology. Respond in ${language === 'hi' ? 'Hindi' : 'English'}. Current Vimshottari context: ${activeDasha}. The theme involves houses ${theme.houses.join(', ')} and the ${theme.varga} divisional chart. Current rule-based interpretation is ${theme.tone}; observed signals: ${signals.join('; ') || 'no strong rule signals were found'}. Verify each claim against my saved D1 chart, relevant divisional chart, dasha and current transits. Explain both supportive and challenging factors, distinguish tradition from certainty, do not invent placements, and give one practical reflection rather than a deterministic prediction.`;
  };

  return (
    <GlassCard className="relative overflow-hidden p-4 sm:p-5 glass-tint-violet">
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-violet/10 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-violet-deep">
          <Icon name="planet" size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-t18 font-semibold text-charcoal">{t('prediction.title')}</h2>
          <p className="mt-1 text-t12 leading-relaxed text-muted-foreground">{t('prediction.subtitle')}</p>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {visibleThemes.map((theme) => {
          const active = expanded === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              aria-expanded={active}
              onClick={() => setExpanded((current) => current === theme.id ? null : theme.id)}
              className={cn(
                'tap-sm min-h-[82px] rounded-2xl px-3 py-3 text-left transition-[background,transform] duration-200 active:scale-[.98]',
                active ? 'bg-violet-soft/65 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]' : 'bg-white/50 hover:bg-white/75',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <Icon name={THEME_ICONS[theme.id]} size={16} className="text-violet-deep" />
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                  theme.tone === 'supportive' ? 'bg-emerald-soft text-emerald-deep' : theme.tone === 'reflective' ? 'bg-burgundy-soft text-burgundy' : 'bg-gold-soft text-[#80651b]',
                )}>{t(`prediction.tone.${theme.tone}`)}</span>
              </span>
              <span className="mt-2 block text-t12 font-semibold leading-tight text-charcoal">{t(`prediction.theme.${theme.id}`)}</span>
              <span className="mt-1 block text-[10px] text-muted-foreground">{t('prediction.houses', { houses: theme.houses.slice(0, 3).join(' · ') })}</span>
            </button>
          );
        })}
      </div>

      {outlook.themes.length > 4 && (
        <button type="button" onClick={() => setShowAll((value) => !value)} className="relative mt-2 inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-t12 font-semibold text-violet-deep hover:bg-white/50">
          {showAll ? t('prediction.showLess') : t('prediction.showAll')}
          <Icon name={showAll ? 'chevron-up' : 'chevron-down'} size={14} />
        </button>
      )}

      {chosen && (
        <div className="relative mt-3 rounded-2xl bg-white/65 p-3.5 animate-in fade-in-50 duration-180" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-serif text-t16 font-semibold text-charcoal">{t(`prediction.theme.${chosen.id}`)}</p>
              <p className="mt-0.5 text-t12 text-muted-foreground">{t('prediction.varga', { varga: chosen.varga })}</p>
            </div>
            <span className="shrink-0 rounded-full bg-gold-faint px-2 py-1 text-[10px] font-semibold text-charcoal/75">{activeDasha}</span>
          </div>
          {chosen.signals.length ? (
            <ul className="mt-3 space-y-2">
              {chosen.signals.slice(0, 4).map((signal, index) => (
                <li key={`${signal.code}-${signal.planet ?? 'chart'}-${signal.house ?? index}-${signal.varga ?? ''}`} className="flex items-start gap-2 text-t12 leading-relaxed text-charcoal/85">
                  <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', signal.direction === 'support' ? 'bg-emerald' : signal.direction === 'reflect' ? 'bg-burgundy' : 'bg-gold')} aria-hidden="true" />
                  <span>{signalText(signal, language, t)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-t12 text-muted-foreground">{t('prediction.noStrongSignals')}</p>
          )}
          {outlook.ashtakavargaApprox && (
            <p className="mt-2 text-t12 text-muted-foreground">{t('prediction.approxNote')}</p>
          )}
          <AskAIAction className="mt-3" label={t('prediction.askAcharya')} question={promptFor(chosen)} />
        </div>
      )}

      <p className="relative mt-3 border-t border-violet/10 pt-3 text-[10.5px] leading-relaxed text-muted-foreground">{t('prediction.disclaimer')}</p>
    </GlassCard>
  );
}
