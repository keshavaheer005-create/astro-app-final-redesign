'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons';
import { GlassCard, SlidingPillTabs, ProgressBar, EmptyState, PageLoader, ErrorState, SectionHeader } from '../ui-primitives';
import { api, useSession } from '../session-context';
import { useAppStore } from '@/store/app';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface HoroscopePayload {
  period: Period;
  score: number;
  moonSign: number;
  headlineKey: 'excellent' | 'good' | 'steady' | 'demanding';
  transits: { key: string; houseFromMoon: number; benefic: boolean; note: 'support' | 'mixed' | 'pressure' }[];
  highlights: string[];
  cautions: string[];
  dashaNote: string;
}

export function HoroscopeScreen() {
  const { t } = useTranslation();
  const { chart } = useSession();
  const language = useAppStore((s) => s.language);
  const [period, setPeriod] = useState<Period>('daily');
  const [data, setData] = useState<HoroscopePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!chart) return;
    setLoading(true);
    setError(false);
    setData(null);
    try {
      const res = await api<{ horoscope: HoroscopePayload }>('/api/horoscope', {
        method: 'POST',
        body: JSON.stringify({
          period,
          birth: {
            name: chart.input.name,
            dob: chart.input.dob,
            tob: chart.input.tob,
            lat: chart.input.lat,
            lng: chart.input.lng,
            timezone: chart.input.timezone,
          },
        }),
      });
      setData(res.horoscope);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [chart, period]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!chart) return <EmptyState icon="sparkle" title={t('home.noChart')} body={t('home.noChartBody')} />;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-t28 font-bold text-charcoal">{t('horoscope.' + period)}</h1>
        <p className="text-t12 text-muted-foreground mt-0.5">{t('horoscope.disclaimer')}</p>
      </header>

      <SlidingPillTabs<Period>
        tabs={[
          { id: 'daily', label: t('horoscope.daily') },
          { id: 'weekly', label: t('horoscope.weekly') },
          { id: 'monthly', label: t('horoscope.monthly') },
          { id: 'yearly', label: t('horoscope.yearly') },
        ]}
        active={period}
        onChange={setPeriod}
      />

      {loading && <PageLoader label={t('common.calculating')} />}
      {error && <ErrorState onRetry={load} message={t('common.networkError')} />}

      {data && (
        <>
          <GlassCard className="p-5 sm:p-6" ink>
            <p className="text-t12 uppercase tracking-wider text-gold font-semibold">
              {t('horoscope.basedOn', { sign: chart.moonSign.name, dasha: data.dashaNote || '—' })}
            </p>
            <h2 className="font-serif text-t28 font-bold mt-2 text-[#f0e4c3]">{t('horoscope.' + data.headlineKey)}</h2>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-t12 text-[#cdb98e] shrink-0">{t('horoscope.score')}</span>
              <ProgressBar value={data.score} className="flex-1 bg-white/10" />
              <span className="text-t14 font-bold text-gold-light shrink-0">{data.score}%</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.highlights.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 border border-gold/30 px-3 py-1 text-t12 text-gold-light">
                  <Icon name="sparkle" size={12} /> {t(`planet.${p}`)} · {t('horoscope.favorable')}
                </span>
              ))}
              {data.cautions.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 rounded-full bg-burgundy/30 border border-burgundy/55 px-3 py-1 text-t12 text-[#ecd0d6]">
                  <Icon name="warning" size={12} /> {t(`planet.${p}`)} · {t('horoscope.pressures')}
                </span>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-4 sm:p-5">
            <SectionHeader title={language === 'hi' ? 'गोचर विवरण' : 'Transit detail'} icon="planet" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto scroll-slim pr-1">
              {data.transits.map((tr) => (
                <div
                  key={tr.key}
                  className={`rounded-xl px-3 py-2.5 border transition-colors duration-200 ${
                    tr.note === 'support'
                      ? 'bg-emerald-faint border-emerald/25'
                      : tr.note === 'pressure'
                        ? 'bg-burgundy-soft/80 border-burgundy/25'
                        : 'bg-white/50 border-gold/15'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-t14 font-semibold text-charcoal">{t(`planet.${tr.key}`)}</span>
                    <span className={`text-t12 font-bold ${tr.benefic ? 'text-emerald-deep' : 'text-burgundy'}`}>
                      {tr.houseFromMoon}
                      <sup>th</sup>
                    </span>
                  </div>
                  <p className="text-t12 text-muted-foreground mt-0.5">
                    {t('chart.moonSummary')} {language === 'hi' ? 'से' : 'from'} · {tr.note === 'support' ? '✓' : tr.note === 'pressure' ? '!' : '·'}{' '}
                    {language === 'hi' ? (tr.benefic ? 'शुभ' : tr.note === 'pressure' ? 'दबाव' : 'मिश्रित') : tr.benefic ? 'favorable' : tr.note === 'pressure' ? 'pressuring' : 'mixed'}
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}
