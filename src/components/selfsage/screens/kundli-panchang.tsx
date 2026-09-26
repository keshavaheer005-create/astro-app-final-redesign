'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons';
import { GlassCard, SectionHeader, EmptyState, PageLoader, ErrorState } from '../ui-primitives';
import { CalendarPicker } from '../pickers';
import { api, useSession } from '../session-context';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';

interface PanchangPayload {
  date: string;
  weekday: number;
  tithi: { name: string; nameHi: string; paksha: string; percent: number; endsAtISO: string | null };
  nakshatra: { name: string; nameHi: string; pada: number; percent: number; endsAtISO: string | null };
  yoga: { name: string; percent: number };
  karana: { name: string };
  moonSign: { name: string; nameHi: string };
  sunSign: { name: string; nameHi: string };
  sunriseISO: string | null;
  sunsetISO: string | null;
  moonriseISO: string | null;
  moonsetISO: string | null;
  rahuKaal: { startISO: string | null; endISO: string | null };
  choghadiya: {
    day: { name: string; quality: 'good' | 'medium' | 'bad'; startISO: string; endISO: string }[];
    night: { name: string; quality: 'good' | 'medium' | 'bad'; startISO: string; endISO: string }[];
  };
  muhurtas: { name: string; startISO: string; endISO: string; note: 'auspicious' | 'caution' }[];
}

export function PanchangScreen() {
  const { t, i18n } = useTranslation();
  const { chart } = useSession();
  const language = useAppStore((s) => s.language);
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';

  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [data, setData] = useState<PanchangPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!chart) return;
    setLoading(true);
    setError(false);
    try {
      const res = await api<{ panchang: PanchangPayload }>('/api/panchang', {
        method: 'POST',
        body: JSON.stringify({ date, lat: chart.input.lat, lng: chart.input.lng, timezone: chart.input.timezone }),
      });
      setData(res.panchang);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [chart, date]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!chart) return <EmptyState icon="sun" title={t('home.noChart')} body={t('home.noChartBody')} />;

  const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: chart.input.timezone }) : '—');

  const limbs = data
    ? [
        { icon: 'moon' as const, label: t('panchang.tithi'), value: language === 'hi' ? `${data.tithi.paksha === 'Shukla' ? 'शुक्ल' : 'कृष्ण'} ${data.tithi.nameHi}` : `${data.tithi.paksha} ${data.tithi.name}`, percent: data.tithi.percent, ends: data.tithi.endsAtISO },
        { icon: 'star' as const, label: t('panchang.nakshatra'), value: language === 'hi' ? data.nakshatra.nameHi : data.nakshatra.name, percent: data.nakshatra.percent, ends: data.nakshatra.endsAtISO },
        { icon: 'sparkle' as const, label: t('panchang.yoga'), value: data.yoga.name, percent: data.yoga.percent, ends: null },
        { icon: 'clock' as const, label: t('panchang.karana'), value: data.karana.name, percent: null, ends: null },
      ]
    : [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-t28 font-bold text-charcoal">{t('panchang.title')}</h1>
        <p className="text-t14 text-muted-foreground">{t('panchang.subtitle')} · {chart.input.placeName}</p>
      </header>

      <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start">
        <GlassCard className="p-4">
          <CalendarPicker value={date} onChange={setDate} />
        </GlassCard>

        <div className="space-y-4 min-w-0">
          {loading && !data && <PageLoader label={t('common.loading')} />}
          {error && <ErrorState onRetry={load} message={t('common.networkError')} />}
          {data && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {limbs.map((l) => (
                  <GlassCard key={l.label} className="p-4">
                    <div className="flex items-center gap-2 text-gold">
                      <Icon name={l.icon} size={16} />
                      <span className="text-t12 uppercase tracking-wide font-semibold text-muted-foreground">{l.label}</span>
                    </div>
                    <p className="mt-2 font-serif text-t20 text-charcoal">{l.value}</p>
                    {l.ends && (
                      <p className="text-t12 text-muted-foreground mt-1">
                        {t('panchang.endsAt', { time: fmtTime(l.ends) })}
                      </p>
                    )}
                    {typeof l.percent === 'number' && (
                      <div className="mt-2 h-1.5 rounded-full bg-gold/15 overflow-hidden">
                        <div className="h-full gold-grad rounded-full" style={{ width: `${l.percent}%` }} />
                      </div>
                    )}
                  </GlassCard>
                ))}
              </div>

              <GlassCard className="p-4 sm:p-5">
                <SectionHeader title={language === 'hi' ? 'समय' : 'Timings'} icon="clock" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <TimeTile icon="sunrise" label={t('panchang.sunrise')} value={fmtTime(data.sunriseISO)} />
                  <TimeTile icon="sunset" label={t('panchang.sunset')} value={fmtTime(data.sunsetISO)} />
                  <TimeTile icon="moon" label={t('panchang.moonrise')} value={fmtTime(data.moonriseISO)} />
                  <TimeTile icon="moon" label={t('panchang.moonset')} value={fmtTime(data.moonsetISO)} />
                </div>
                {data.rahuKaal.startISO && data.rahuKaal.endISO && (
                  <div className="mt-4 rounded-xl bg-maroon-soft border border-maroon/25 px-4 py-3 flex items-start gap-3">
                    <Icon name="warning" size={18} className="text-maroon mt-0.5" />
                    <div>
                      <p className="text-t14 font-semibold text-maroon">
                        {t('panchang.rahuKaal')}: {fmtTime(data.rahuKaal.startISO)} – {fmtTime(data.rahuKaal.endISO)}
                      </p>
                      <p className="text-t12 text-maroon/75">{t('panchang.avoidWindow')}</p>
                    </div>
                  </div>
                )}
                <p className="mt-4 text-t12 text-muted-foreground">
                  {t('panchang.moonSign')}: <span className="text-charcoal font-medium">{language === 'hi' ? data.moonSign.nameHi : data.moonSign.name}</span> · {t('panchang.paksha')}: <span className="text-charcoal font-medium">{language === 'hi' ? (data.tithi.paksha === 'Shukla' ? 'शुक्ल' : 'कृष्ण') : data.tithi.paksha}</span> · {t('weekdays.' + data.weekday)}
                </p>
              </GlassCard>

              {/* Muhurtas */}
              {data.muhurtas.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {data.muhurtas.map((m) => (
                    <GlassCard key={m.name} className="p-4">
                      <div className="flex items-center gap-2 text-gold">
                        <Icon name="lotus" size={16} />
                        <span className="text-t12 uppercase tracking-wide font-semibold text-muted-foreground">{t(`muhurta.${m.name.toLowerCase()}`)}</span>
                      </div>
                      <p className="mt-2 text-t14 font-semibold text-charcoal">
                        {fmtTime(m.startISO)} – {fmtTime(m.endISO)}
                      </p>
                      <p className="text-t12 text-muted-foreground mt-1 leading-snug">{t(`muhurta.${m.name.toLowerCase()}Note`)}</p>
                    </GlassCard>
                  ))}
                </div>
              )}

              {/* Choghadiya */}
              {data.choghadiya.day.length > 0 && (
                <GlassCard className="p-4 sm:p-5">
                  <SectionHeader title={t('choghadiya.title')} icon="clock" />
                  <ChoghadiyaGrid slots={data.choghadiya.day} label={t('choghadiya.day')} locale={locale} tz={chart.input.timezone} now />
                  <div className="h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent my-4" />
                  <ChoghadiyaGrid slots={data.choghadiya.night} label={t('choghadiya.night')} locale={locale} tz={chart.input.timezone} now />
                </GlassCard>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TimeTile({ icon, label, value }: { icon: 'sunrise' | 'sunset' | 'moon'; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gold-faint/70 border border-gold/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-gold">
        <Icon name={icon} size={14} />
        <span className="text-t12 text-muted-foreground truncate">{label}</span>
      </div>
      <p className="mt-1 text-t14 font-semibold text-charcoal">{value}</p>
    </div>
  );
}

const QUALITY_STYLE = {
  good: 'bg-gold-faint border-gold/40 text-[#7a8b6f]',
  medium: 'bg-white/55 border-gold/20 text-muted-foreground',
  bad: 'bg-maroon-soft/70 border-maroon/25 text-maroon',
} as const;

function ChoghadiyaGrid({
  slots,
  label,
  locale,
  tz,
  now = false,
}: {
  slots: { name: string; quality: 'good' | 'medium' | 'bad'; startISO: string; endISO: string }[];
  label: string;
  locale: string;
  tz: string;
  now?: boolean;
}) {
  const { t } = useTranslation();
  const nowMs = Date.now();
  return (
    <div className="mt-2">
      <p className="text-t12 font-semibold uppercase tracking-wide text-gold mb-2">{label}</p>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {slots.map((s, i) => {
          const isNow = now && new Date(s.startISO).getTime() <= nowMs && new Date(s.endISO).getTime() > nowMs;
          return (
            <div
              key={`${s.name}-${i}`}
              className={cn(
                'rounded-lg border px-1.5 py-2 text-center transition-all duration-200',
                QUALITY_STYLE[s.quality],
                isNow && 'ring-2 ring-gold shadow-[0_2px_10px_rgba(201,162,39,0.3)] scale-[1.04]',
              )}
              title={`${new Date(s.startISO).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: tz })} – ${new Date(s.endISO).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: tz })}`}
            >
              <p className="text-t12 font-semibold truncate">{s.name}</p>
              <p className="text-t12 opacity-70">{t(`choghadiya.${s.quality}`)}</p>
              {isNow && <p className="text-t12 font-bold text-gold mt-0.5">{t('choghadiya.now')}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
