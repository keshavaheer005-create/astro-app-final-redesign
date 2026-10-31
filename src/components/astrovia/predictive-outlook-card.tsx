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

// Liquid-glass insight cards: theme colour lives ONLY in the small icon
// chip + tone pill; the card itself stays a neutral glass bubble.
const THEME_ACCENTS: Record<PredictionThemeId, { gradient: string; icon: string }> = {
  career: { gradient: 'bg-emerald-soft/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]', icon: 'text-emerald-deep' },
  relationships: { gradient: 'bg-rose-soft/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]', icon: 'text-rose-deep' },
  wealth: { gradient: 'bg-gold-soft/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]', icon: 'text-gold-deep' },
  learning: { gradient: 'bg-violet-soft/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]', icon: 'text-violet-deep' },
  home: { gradient: 'bg-emerald-faint/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]', icon: 'text-emerald-deep' },
  wellbeing: { gradient: 'bg-burgundy-soft/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]', icon: 'text-burgundy' },
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
    <GlassCard tone="violet" className="relative overflow-hidden p-4 sm:p-5">
      <div className="relative flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-soft/90 text-violet-deep shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_2px_10px_-3px_rgba(139,41,69,0.3)] backdrop-blur-sm">
          <Icon name="planet" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-t22 font-bold tracking-[-0.02em] text-charcoal">{t('prediction.title')}</h2>
          <p className="mt-1 text-t14 leading-relaxed text-charcoal/70">{t('prediction.subtitle')}</p>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {visibleThemes.map((theme) => {
          const active = expanded === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              aria-expanded={active}
              onClick={() => setExpanded((current) => current === theme.id ? null : theme.id)}
              className={cn(
                'tap-sm min-h-[86px] rounded-2xl px-3 py-3 text-left backdrop-blur-sm',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_3px_12px_-6px_rgba(42,36,32,0.16)]',
                'transition-[background,transform,box-shadow] duration-200 active:scale-[.98]',
                active ? 'bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_6px_18px_-6px_rgba(42,36,32,0.2)]' : 'bg-white/50 hover:bg-white/70',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl', THEME_ACCENTS[theme.id].gradient)}>
                  <Icon name={THEME_ICONS[theme.id]} size={16} className={THEME_ACCENTS[theme.id].icon} />
                </span>
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]',
                  theme.tone === 'supportive' ? 'bg-emerald-soft/90 text-emerald-deep' : theme.tone === 'reflective' ? 'bg-burgundy-soft/90 text-burgundy' : 'bg-gold-soft/90 text-[#7a5f18]',
                )}>{t(`prediction.tone.${theme.tone}`)}</span>
              </span>
              <span className="mt-2.5 block text-t14 font-bold leading-tight tracking-[-0.01em] text-charcoal">{t(`prediction.theme.${theme.id}`)}</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{t('prediction.houses', { houses: theme.houses.slice(0, 3).join(' · ') })}</span>
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
        <div className="relative mt-3 rounded-2xl bg-white/70 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_-8px_rgba(42,36,32,0.16)] backdrop-blur-sm animate-in fade-in-50 duration-180" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-serif text-t18 font-bold tracking-[-0.01em] text-charcoal">{t(`prediction.theme.${chosen.id}`)}</p>
              <p className="mt-0.5 text-t12 text-muted-foreground">{t('prediction.varga', { varga: chosen.varga })}</p>
            </div>
            <span className="shrink-0 rounded-full bg-gold-faint/90 px-2 py-1 text-[11px] font-semibold text-charcoal/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">{activeDasha}</span>
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

      <p className="relative mt-3 pt-3 border-t border-violet/10 text-t12 leading-relaxed text-muted-foreground">{t('prediction.disclaimer')}</p>
    </GlassCard>
  );
}
