'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '../icons';
import { GlassCard, GoldButton, SectionHeader, ProgressBar, EmptyState } from '../ui-primitives';
import { api, useSession } from '../session-context';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';

const ACTIVITIES: { id: string; icon: IconName }[] = [
  { id: 'griha_pravesh', icon: 'home' },
  { id: 'vehicle', icon: 'compass' },
  { id: 'business', icon: 'trending' },
  { id: 'property', icon: 'pin' },
  { id: 'travel', icon: 'globe' },
  { id: 'naming', icon: 'sparkle' },
  { id: 'annaprashan', icon: 'lotus' },
  { id: 'mundan', icon: 'user' },
  { id: 'vidyarambh', icon: 'book' },
  { id: 'vivah', icon: 'heart' },
];

interface Reason {
  key: string;
  vars?: Record<string, string | number>;
}
interface Result {
  date: string;
  weekday: number;
  score: number;
  verdict: 'excellent' | 'good' | 'fair';
  tithi: { name: string; nameHi: string; paksha: 'Shukla' | 'Krishna' };
  nakshatra: { name: string; nameHi: string };
  windows: { startISO: string; endISO: string; score: number }[];
  positives: Reason[];
  cautions: Reason[];
}

const VERDICT_STYLE = {
  excellent: 'bg-gold-faint border-gold/50 text-[#7a6a1f]',
  good: 'bg-emerald-soft/70 border-emerald/30 text-emerald-deep',
  fair: 'bg-white/60 border-gold/25 text-muted-foreground',
} as const;

const todayLocal = (tz: string) => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

export function MuhuratFinder({ onOpenDay }: { onOpenDay: (date: string) => void }) {
  const { t } = useTranslation();
  const { chart } = useSession();
  const language = useAppStore((s) => s.language);
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';

  const [activity, setActivity] = useState<string>('griha_pravesh');
  const [days, setDays] = useState(60);
  const [personal, setPersonal] = useState(true);
  const [results, setResults] = useState<Result[] | null>(null);
  const [searched, setSearched] = useState<string | null>(null); // activity the shown results belong to
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  if (!chart) return <EmptyState icon="sun" title={t('home.noChart')} body={t('home.noChartBody')} />;
  const tz: string = chart.input.timezone;

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: tz });
  const fmtDate = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const moon = chart.planets?.find((p: { key: string }) => p.key === 'Mo');
  const canPersonalise = Boolean(moon && chart.moonSign);

  const find = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api<{ results: Result[] }>('/api/muhurat', {
        method: 'POST',
        body: JSON.stringify({
          activity,
          startDate: todayLocal(tz),
          days,
          lat: chart.input.lat,
          lng: chart.input.lng,
          timezone: tz,
          ...(personal && canPersonalise ? { natalNak: moon.nakshatra, natalMoonSign: chart.moonSign.index } : {}),
        }),
      });
      setResults(res.results);
      setSearched(activity);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('muhurat.title')} icon="clock" />
        <p className="mb-3 text-t12 leading-relaxed text-muted-foreground">{t('muhurat.subtitle')}</p>

        <p className="mb-2 text-t12 font-semibold uppercase tracking-wider text-gold">{t('muhurat.activityLabel')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('muhurat.activityLabel')}>
          {ACTIVITIES.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={activity === a.id}
              onClick={() => setActivity(a.id)}
              className={cn(
                'tap-sm flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-t14 transition-colors duration-200',
                activity === a.id
                  ? 'border-gold/60 bg-gold-faint text-charcoal shadow-[0_2px_10px_rgba(201,162,39,0.22)]'
                  : 'border-gold/20 bg-white/55 text-muted-foreground hover:text-charcoal',
              )}
            >
              <Icon name={a.icon} size={15} className={activity === a.id ? 'text-gold' : ''} />
              <span className="leading-tight">{t(`muhurat.activity.${a.id}`)}</span>
            </button>
          ))}
        </div>

        <p className="mb-2 mt-4 text-t12 font-semibold uppercase tracking-wider text-gold">{t('muhurat.range')}</p>
        <div className="inline-flex rounded-full border border-gold/25 bg-white/55 p-1" role="radiogroup" aria-label={t('muhurat.range')}>
          {[30, 60, 90].map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              onClick={() => setDays(d)}
              className={cn(
                'tap-sm rounded-full px-4 py-1.5 text-t14 transition-colors duration-200',
                days === d ? 'bg-gold-faint font-medium text-charcoal' : 'text-muted-foreground hover:text-charcoal',
              )}
            >
              {t('muhurat.daysN', { n: d })}
            </button>
          ))}
        </div>

        {canPersonalise && (
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-t14 text-charcoal">
            <input
              type="checkbox"
              checked={personal}
              onChange={(e) => setPersonal(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#C9A227]"
            />
            <span>
              {t('muhurat.personalise')}
              <span className="block text-t12 text-muted-foreground">{t('muhurat.personaliseHint')}</span>
            </span>
          </label>
        )}

        {activity === 'vivah' && (
          <p className="mt-3 rounded-xl border border-gold/25 bg-gold-faint/60 px-3 py-2 text-t12 leading-relaxed text-charcoal/85">
            {t('muhurat.vivahNote')}
          </p>
        )}

        <GoldButton className="mt-4 w-full" onClick={find} disabled={loading}>
          {loading ? t('muhurat.finding') : t('muhurat.find')}
        </GoldButton>
        {error && <p className="mt-2 text-center text-t12 text-burgundy">{t('common.networkError')}</p>}
      </GlassCard>

      {results && searched && (
        <div className="space-y-3">
          <p className="px-1 text-t14 font-semibold text-charcoal">
            {t(`muhurat.activity.${searched}`)} · {t('muhurat.resultsFound', { n: results.length })}
          </p>
          {results.length === 0 && (
            <GlassCard className="p-4 text-t14 text-muted-foreground">{t('muhurat.none')}</GlassCard>
          )}
          {results.map((r) => (
            <GlassCard key={r.date} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-serif text-t16 font-semibold text-charcoal">{fmtDate(r.date)}</p>
                  <p className="text-t12 text-muted-foreground">
                    {language === 'hi' ? r.nakshatra.nameHi : r.nakshatra.name} · {t(`muhurat.paksha.${r.tithi.paksha}`)}{' '}
                    {language === 'hi' ? r.tithi.nameHi : r.tithi.name}
                  </p>
                </div>
                <span className={cn('shrink-0 rounded-full border px-2.5 py-0.5 text-t12 font-semibold', VERDICT_STYLE[r.verdict])}>
                  {t(`muhurat.verdict.${r.verdict}`)}
                </span>
              </div>

              <div className="mt-2.5">
                <ProgressBar value={Math.min(100, r.score)} tone={r.verdict === 'fair' ? 'gold' : 'emerald'} />
              </div>

              <p className="mb-1.5 mt-3 text-t12 font-semibold uppercase tracking-wider text-gold">{t('muhurat.bestTime')}</p>
              <div className="flex flex-wrap gap-1.5">
                {r.windows.map((w) => (
                  <span key={w.startISO} className="inline-flex items-center gap-1 rounded-full border border-emerald/25 bg-emerald-soft/60 px-2.5 py-1 text-t12 font-medium text-emerald-deep">
                    <Icon name="clock" size={12} />
                    {fmtTime(w.startISO)} – {fmtTime(w.endISO)}
                  </span>
                ))}
              </div>

              <ul className="mt-3 space-y-1">
                {r.positives.map((p) => (
                  <li key={p.key} className="flex items-start gap-1.5 text-t12 leading-relaxed text-charcoal/85">
                    <Icon name="check" size={13} className="mt-0.5 shrink-0 text-emerald" />
                    <span>{t(`muhurat.reason.${p.key}`, p.vars)}</span>
                  </li>
                ))}
                {r.cautions.map((c) => (
                  <li key={c.key} className="flex items-start gap-1.5 text-t12 leading-relaxed text-burgundy/90">
                    <Icon name="warning" size={13} className="mt-0.5 shrink-0" />
                    <span>{t(`muhurat.reason.${c.key}`, c.vars)}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => onOpenDay(r.date)}
                className="tap-sm mt-3 inline-flex items-center gap-1 text-t12 font-semibold text-gold hover:underline"
              >
                {t('muhurat.openDay')} <Icon name="arrow-right" size={12} />
              </button>
            </GlassCard>
          ))}
          <p className="px-1 text-t12 leading-relaxed text-muted-foreground/90">{t('muhurat.disclaimer')}</p>
        </div>
      )}
    </div>
  );
}
