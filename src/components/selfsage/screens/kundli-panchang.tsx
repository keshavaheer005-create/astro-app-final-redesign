'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, AcharyaAvatar } from '../icons';
import { GlassCard, SectionHeader, EmptyState, PageLoader, ErrorState } from '../ui-primitives';
import { GlassDatePicker } from '../pickers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { api, useSession } from '../session-context';
import { useAppStore } from '@/store/app';
import { cn, choghName } from '@/lib/utils';

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

interface Observance {
  lunarMonth: { key: string; en: string; hi: string; adhika?: boolean } | null;
  festivals: FestivalInfo[];
}

interface FestivalInfo {
  en: string;
  hi: string;
  kind: 'festival' | 'ekadashi' | 'sankranti';
  month?: string;
  anchor?: string;
}

interface MonthDay {
  date: string;
  weekday: number;
  tithi: { index: number; name: string; nameHi: string; paksha: 'Shukla' | 'Krishna' };
  nakshatra: { name: string; nameHi: string };
  sunriseISO: string | null;
  special: 'purnima' | 'amavasya' | 'ekadashi' | null;
  lunarMonth: { key: string; en: string; hi: string; adhika?: boolean } | null;
  festivals: FestivalInfo[];
}

/** Festival picked for the significance dialog. */
interface FestDetail {
  en: string;
  hi: string;
  kind: 'festival' | 'ekadashi' | 'sankranti';
  date: string;
  anchor?: string;
}

/** Compose a human-readable classical timing from festival month+anchor (e.g. "Bhadrapada, Shukla 15"). */
function anchorText(f: FestivalInfo): string | undefined {
  if (!f.anchor) return undefined;
  const paksha = f.anchor.startsWith('S') ? 'Shukla' : 'Krishna';
  const num = f.anchor.slice(1);
  const monthName = f.month ? f.month.charAt(0).toUpperCase() + f.month.slice(1) : '';
  return [monthName, `${paksha} ${num}`].filter(Boolean).join(', ');
}

export function PanchangScreen() {
  const { t, i18n } = useTranslation();
  const { chart } = useSession();
  const language = useAppStore((s) => s.language);
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';

  const [mode, setMode] = useState<'day' | 'month'>('day');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<PanchangPayload | null>(null);
  const [observance, setObservance] = useState<Observance | null>(null);
  const [monthData, setMonthData] = useState<MonthDay[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [festDetail, setFestDetail] = useState<FestDetail | null>(null);
  const [flashDay, setFlashDay] = useState(false);

  const load = useCallback(async () => {
    if (!chart) return;
    setLoading(true);
    setError(false);
    try {
      if (mode === 'month') {
        const res = await api<{ days: MonthDay[] }>('/api/panchang', {
          method: 'POST',
          body: JSON.stringify({ month, lat: chart.input.lat, lng: chart.input.lng, timezone: chart.input.timezone }),
        });
        setMonthData(res.days);
      } else {
        const res = await api<{ panchang: PanchangPayload; observance: Observance }>('/api/panchang', {
          method: 'POST',
          body: JSON.stringify({ date, lat: chart.input.lat, lng: chart.input.lng, timezone: chart.input.timezone }),
        });
        setData(res.panchang);
        setObservance(res.observance ?? null);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [chart, date, mode, month]);

  useEffect(() => {
    void load();
  }, [load]);

  // One-shot handoff: a sky chip on Home asked to open a specific day
  // ("panchang:<date>") — switch to day view, select the date, flash the limbs.
  useEffect(() => {
    const focus = useAppStore.getState().consumePendingFocus();
    if (focus?.startsWith('panchang:')) {
      const d = focus.slice('panchang:'.length);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        setMode('day');
        setDate(d);
        setFlashDay(true);
        const id = window.setTimeout(() => setFlashDay(false), 1800);
        return () => window.clearTimeout(id);
      }
    }
  }, []);

  if (!chart) return <EmptyState icon="sun" title={t('home.noChart')} body={t('home.noChartBody')} />;

  const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: chart.input.timezone }) : '—');
  const todayStr = (() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: chart.input.timezone }).format(new Date());
    } catch {
      return '';
    }
  })();

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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-t28 font-bold text-charcoal">{t('panchang.title')}</h1>
          <p className="text-t14 text-muted-foreground">{t('panchang.subtitle')} · {chart.input.placeName}</p>
        </div>
        {/* Day / Month segmented toggle */}
        <div className="glass rounded-full p-1 flex items-center gap-1" role="tablist" aria-label={t('panchang.modeAria')}>
          {(['day', 'month'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-full px-4 py-1.5 text-t14 font-medium transition-all duration-250 active:scale-95',
                mode === m ? 'gold-grad text-charcoal shadow-[0_2px_8px_rgba(201,162,39,0.35)]' : 'text-muted-foreground hover:text-charcoal',
              )}
            >
              {t(`panchang.mode.${m}`)}
            </button>
          ))}
        </div>
      </header>

      {mode === 'day' ? (
        <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start">
          <GlassCard className="p-4">
            <GlassDatePicker value={date} onChange={setDate} minYear={1900} maxYear={new Date().getFullYear() + 1} ariaLabel={t('panchang.mode.day')} />
          </GlassCard>

        <div className="space-y-4 min-w-0">
          {loading && !data && <PageLoader label={t('common.loading')} />}
          {error && <ErrorState onRetry={load} message={t('common.networkError')} />}
          {data && (
            <>
              <div className={cn('grid grid-cols-2 gap-3 rounded-2xl', flashDay && 'focus-flash')}>
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

              {/* Today's observances — festivals, ekadashi, sankranti (tap → significance) */}
              {observance && observance.festivals.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {observance.festivals.map((f) => (
                    <button
                      key={f.en}
                      type="button"
                      onClick={() => setFestDetail({ en: f.en, hi: f.hi, kind: f.kind, date, anchor: anchorText(f) })}
                      title={t('panchang.festDetailHint')}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-t12 font-semibold border transition-all duration-200 hover:-translate-y-px active:scale-95 cursor-pointer',
                        f.kind === 'sankranti'
                          ? 'bg-sage/10 border-sage/40 text-[#5c6b52]'
                          : f.kind === 'ekadashi'
                            ? 'bg-gold-faint border-gold/40 text-[#8a6d1f]'
                            : 'bg-gold-soft/80 border-gold/60 text-[#7a5c10] shadow-[0_1px_6px_rgba(201,162,39,0.25)]',
                      )}
                    >
                      <Icon name={f.kind === 'sankranti' ? 'compass' : 'lotus'} size={13} />
                      {language === 'hi' ? f.hi : f.en}
                      <Icon name="chevron-right" size={11} className="opacity-50" />
                    </button>
                  ))}
                </div>
              )}
              {observance?.lunarMonth && (
                <p className="text-t12 text-muted-foreground">
                  {t('panchang.lunarMonth')}:{' '}
                  <span className="text-charcoal font-medium">{language === 'hi' ? observance.lunarMonth.hi : observance.lunarMonth.en}</span>
                  {observance.lunarMonth.adhika && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-gold-faint border border-gold/40 px-2 py-0.5 text-[10px] font-semibold text-[#8a6d1f] uppercase tracking-wide">
                      {t('panchang.adhika')}
                    </span>
                  )}
                </p>
              )}

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
                  <ChoghadiyaGrid slots={data.choghadiya.day} label={t('choghadiya.day')} locale={locale} tz={chart.input.timezone} now language={language} />
                  <div className="h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent my-4" />
                  <ChoghadiyaGrid slots={data.choghadiya.night} label={t('choghadiya.night')} locale={locale} tz={chart.input.timezone} now language={language} />
                </GlassCard>
              )}
            </>
          )}
        </div>
      </div>
      ) : (
        /* ── Month view ── */
        <GlassCard className="p-4 sm:p-5">
          {loading && !monthData && <PageLoader label={t('common.loading')} />}
          {error && monthData && <ErrorState onRetry={load} message={t('common.networkError')} />}
          {monthData && monthData.length > 0 && (
            <MonthGrid
              month={month}
              days={monthData}
              today={todayStr}
              locale={locale}
              language={language}
              onPrev={() => shiftMonth(month, -1, setMonth)}
              onNext={() => shiftMonth(month, 1, setMonth)}
              onPickDay={(d) => {
                setDate(d);
                setMode('day');
              }}
              onInfo={(d, f) => setFestDetail({ en: f.en, hi: f.hi, kind: f.kind, date: d, anchor: anchorText(f) })}
              prevLabel={t('common.previousMonth')}
              nextLabel={t('common.nextMonth')}
            />
          )}
        </GlassCard>
      )}

      {/* Festival significance dialog (Acharya) */}
      <FestivalDetailDialog
        key={festDetail ? `${festDetail.kind}-${festDetail.en}-${festDetail.date}` : 'none'}
        detail={festDetail}
        onClose={() => setFestDetail(null)}
      />
    </div>
  );
}

function shiftMonth(month: string, delta: number, set: (v: string) => void) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  set(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
}

function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const WEEKDAY_MIN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function MonthGrid({
  month,
  days,
  today,
  locale,
  language,
  onPrev,
  onNext,
  onPickDay,
  onInfo,
  prevLabel,
  nextLabel,
}: {
  month: string;
  days: MonthDay[];
  today: string;
  locale: string;
  language: 'en' | 'hi';
  onPrev: () => void;
  onNext: () => void;
  onPickDay: (date: string) => void;
  onInfo: (date: string, f: FestivalInfo) => void;
  prevLabel: string;
  nextLabel: string;
}) {
  const { t } = useTranslation();
  const [y, m] = month.split('-').map(Number);
  const firstWeekday = days[0]?.weekday ?? new Date(Date.UTC(y, m - 1, 1)).getUTCDay();

  // Dominant purnimanta lunar month across the displayed days + adhika flag
  // (a leap month repeats the previous name — any day marked adhika wins).
  const lunarInfo = (() => {
    const counts = new Map<string, { n: number; name: NonNullable<MonthDay['lunarMonth']> }>();
    for (const d of days) {
      if (!d.lunarMonth) continue;
      const cur = counts.get(d.lunarMonth.key) ?? { n: 0, name: d.lunarMonth };
      cur.n += 1;
      if (d.lunarMonth.adhika) cur.name = d.lunarMonth;
      counts.set(d.lunarMonth.key, cur);
    }
    const dominant = [...counts.values()].sort((a, b) => b.n - a.n)[0];
    return dominant ? { name: dominant.name, adhika: dominant.name.adhika === true } : null;
  })();

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <button
          type="button"
          onClick={onPrev}
          aria-label={prevLabel}
          className="w-9 h-9 rounded-full glass inline-flex items-center justify-center text-gold hover:border-gold/50 active:scale-90 transition-all duration-200"
        >
          <Icon name="chevron-left" size={16} />
        </button>
        <p className="font-serif text-t20 text-charcoal">{monthLabel(month, locale)}</p>
        <button
          type="button"
          onClick={onNext}
          aria-label={nextLabel}
          className="w-9 h-9 rounded-full glass inline-flex items-center justify-center text-gold hover:border-gold/50 active:scale-90 transition-all duration-200"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>

      {/* Lunar month + adhika strip */}
      {lunarInfo && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/60 border border-gold/25 px-2.5 py-1 text-t12 text-muted-foreground">
            <Icon name="moon" size={13} className="text-gold" />
            {t('panchang.lunarMonth')}:{' '}
            <span className="text-charcoal font-medium">{language === 'hi' ? lunarInfo.name.hi : lunarInfo.name.en}</span>
          </span>
          {lunarInfo.adhika && (
            <span className="inline-flex items-center rounded-full bg-gold-faint/80 border border-gold/40 px-2.5 py-1 text-t12 font-semibold text-[#8a6d1f]">
              {t('panchang.adhika')}
            </span>
          )}
        </div>
      )}

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {WEEKDAY_MIN.map((w, i) => (
          <div key={w} className={cn('text-center text-t12 font-semibold', i === 0 || i === 6 ? 'text-maroon/70' : 'text-muted-foreground')}>
            {t(`weekdaysShort.${i}`)}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={monthLabel(month, locale)}>
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`pad-${i}`} aria-hidden />
        ))}
        {days.map((d) => {
          const dayNum = Number(d.date.slice(8, 10));
          const isToday = d.date === today;
          const festival = d.festivals.find((f) => f.kind === 'festival') ?? d.festivals[0];
          const festName = festival ? (language === 'hi' ? festival.hi : festival.en) : null;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onPickDay(d.date)}
              title={`${d.date} · ${language === 'hi' ? `${d.tithi.paksha === 'Shukla' ? 'शुक्ल' : 'कृष्ण'} ${d.tithi.nameHi}` : `${d.tithi.paksha} ${d.tithi.name}`} · ${language === 'hi' ? d.nakshatra.nameHi : d.nakshatra.name}${festName ? ` · ${festName}` : ''}`}
              className={cn(
                'relative rounded-lg border px-0.5 py-1.5 text-center transition-all duration-200 active:scale-90 hover:border-gold/50',
                d.tithi.paksha === 'Shukla' ? 'bg-gold-faint/60 border-gold/25' : 'bg-white/50 border-gold/15',
                d.special === 'purnima' && 'bg-gold-soft/80 border-gold/60 shadow-[0_1px_8px_rgba(201,162,39,0.35)]',
                d.special === 'amavasya' && 'bg-maroon-soft border-maroon/35',
                d.special === 'ekadashi' && 'bg-sage/15 border-sage/40',
                festival && 'border-gold/70',
                isToday && 'ring-2 ring-gold ring-offset-1 ring-offset-[#FAF7F0]',
              )}
            >
              <span className={cn('block text-t12 font-semibold leading-none', d.special === 'amavasya' ? 'text-maroon' : 'text-charcoal')}>
                {dayNum}
              </span>
              <span className={cn('block text-[10px] leading-tight truncate', festival && festName ? 'text-[#8a6d1f] font-semibold' : d.special === 'amavasya' ? 'text-maroon/80' : 'text-muted-foreground/90')}>
                {festName ?? (language === 'hi' ? d.tithi.nameHi : d.tithi.name)}
              </span>
              {d.special && (
                <span
                  className={cn(
                    'absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full',
                    d.special === 'purnima' && 'bg-gold',
                    d.special === 'amavasya' && 'bg-maroon',
                    d.special === 'ekadashi' && 'bg-sage',
                  )}
                  aria-hidden
                />
              )}
              {/* Festival tap-badge — opens the Acharya significance dialog
                  without leaving the month view (keyboard users: the list
                  below the grid has full-size, fully labelled buttons). */}
              {festival && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`${festName} — ${t('panchang.festDetailHint')}`}
                  title={t('panchang.festDetailHint')}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onInfo(d.date, festival);
                  }}
                  className="absolute -top-1 -left-1 w-5 h-5 rounded-full gold-grad shadow-[0_1px_5px_rgba(201,162,39,0.5)] inline-flex items-center justify-center text-charcoal cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-90 animate-in zoom-in-50 fade-in duration-300"
                >
                  <Icon name={festival.kind === 'sankranti' ? 'compass' : 'lotus'} size={11} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Festivals this month */}
      {(() => {
        const festDays = days.filter((d) => d.festivals.length > 0);
        if (festDays.length === 0) return null;
        return (
          <div className="mt-4 rounded-xl bg-gold-faint/50 border border-gold/25 overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-gold/20 flex items-center gap-2">
              <Icon name="lotus" size={14} className="text-gold" />
              <p className="text-t12 font-bold uppercase tracking-wider text-gold">{t('panchang.festivalsThisMonth')}</p>
            </div>
            <div className="max-h-56 overflow-y-auto scroll-slim">
              {festDays.map((d) =>
                d.festivals.map((f) => (
                  <div key={`${d.date}-${f.en}`} className="flex items-center border-b border-gold/10 last:border-b-0 hover:bg-gold-soft/60 transition-colors duration-150">
                    <button
                      type="button"
                      onClick={() => onPickDay(d.date)}
                      className="flex-1 min-w-0 text-left px-3.5 py-2 flex items-center gap-2.5"
                    >
                      <span className="w-9 shrink-0 text-center rounded-md bg-white/70 border border-gold/25 py-0.5 text-t12 font-bold text-charcoal">
                        {Number(d.date.slice(8, 10))}
                      </span>
                      <span className="flex-1 min-w-0 text-t12 text-charcoal truncate">{language === 'hi' ? f.hi : f.en}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onInfo(d.date, f)}
                      aria-label={t('panchang.festDetailHint')}
                      title={t('panchang.festDetailHint')}
                      className="shrink-0 w-7 h-7 mr-1 rounded-full inline-flex items-center justify-center text-gold/80 hover:text-gold hover:bg-gold-faint active:scale-90 transition-all duration-150"
                    >
                      <Icon name="info" size={14} />
                    </button>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold mr-3.5',
                        f.kind === 'sankranti' ? 'bg-sage/15 text-[#5c6b52]' : f.kind === 'ekadashi' ? 'bg-gold-faint text-[#8a6d1f]' : 'bg-gold-soft text-[#7a5c10]',
                      )}
                    >
                      {t(`panchang.festKind.${f.kind}`)}
                    </span>
                  </div>
               )),
              )}
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-t12 text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gold" /> {t('panchang.purnima')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-maroon" /> {t('panchang.amavasya')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sage" /> {t('panchang.ekadashi')}</span>
        <span className="text-muted-foreground/70">{t('panchang.monthHint')}</span>
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
  language,
}: {
  slots: { name: string; quality: 'good' | 'medium' | 'bad'; startISO: string; endISO: string }[];
  label: string;
  locale: string;
  tz: string;
  now?: boolean;
  language: 'en' | 'hi';
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
              <p className="text-t12 font-semibold truncate">{choghName(t, s.name)}</p>
              <p className="text-t12 opacity-70">{t(`choghadiya.${s.quality}`)}</p>
              {isNow && <p className="text-t12 font-bold text-gold mt-0.5">{t('choghadiya.now')}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Festival / parva significance dialog — Acharya-generated classical note,
 * cached per (lang|kind|name) in localStorage so it generates only once.
 */
function FestivalDetailDialog({ detail, onClose }: { detail: FestDetail | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const language = useAppStore((s) => s.language);
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  const [text, setText] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  // spoken version of the note — cached in localStorage (quota-guarded)
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioCacheKey = detail ? `ss-fest-audio-${language}-${detail.kind}-${detail.en}` : null;

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setAudioState('idle');
  }, []);

  // The dialog is remounted per detail (keyed by parent), so audio state and
  // playback reset naturally on change; stop on unmount only.
  useEffect(() => () => stopAudio(), [stopAudio]);

  const toggleAudio = async () => {
    if (audioState === 'playing') {
      stopAudio();
      return;
    }
    if (audioRef.current) {
      void audioRef.current.play().catch(() => setAudioState('idle'));
      setAudioState('playing');
      return;
    }
    if (!text || !audioCacheKey) return;
    setAudioState('loading');
    try {
      let uri: string | null = null;
      try {
        uri = localStorage.getItem(audioCacheKey);
      } catch {
        /* private mode */
      }
      if (!uri) {
        const res = await api<{ audioDataUri: string }>('/api/festival-audio', {
          method: 'POST',
          body: JSON.stringify({ kind: detail?.kind, name: detail?.en, language, text }),
        });
        uri = res.audioDataUri;
        try {
          localStorage.setItem(audioCacheKey, uri);
        } catch {
          /* quota — skip caching */
        }
      }
      const audio = new Audio(uri);
      audio.onended = () => {
        setAudioState('idle');
        audioRef.current = null;
      };
      audioRef.current = audio;
      void audio.play().catch(() => setAudioState('idle'));
      setAudioState('playing');
    } catch {
      setAudioState('idle');
    }
  };

  useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    const run = async () => {
      setState('loading');
      setText(null);
      const cacheKey = `ss-fest-${language}-${detail.kind}-${detail.en}`;
      try {
        const hit = localStorage.getItem(cacheKey);
        if (hit) {
          if (!cancelled) {
            setText(hit);
            setState('ready');
          }
          return;
        }
      } catch {
        /* private mode — skip cache */
      }
      try {
        const res = await api<{ text: string }>('/api/festival-detail', {
          method: 'POST',
          body: JSON.stringify({ name: detail.en, kind: detail.kind, language, anchor: detail.anchor }),
        });
        if (cancelled) return;
        setText(res.text);
        setState('ready');
        try {
          localStorage.setItem(cacheKey, res.text);
        } catch {
          /* ignore */
        }
      } catch {
        if (!cancelled) setState('error');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [detail, language]);

  const kindLabel = detail ? t(`panchang.festKind.${detail.kind}`) : '';
  const dateLine = detail
    ? new Date(`${detail.date}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    : '';

  return (
    <Dialog open={!!detail} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass border-gold/30 max-w-md p-0 overflow-hidden gap-0" showCloseButton>
        {detail && (
          <>
            <DialogHeader className="px-5 pt-5 pb-3 border-b border-gold/15 bg-gold-faint/50">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    detail.kind === 'sankranti' ? 'bg-sage/15 text-[#5c6b52]' : detail.kind === 'ekadashi' ? 'bg-gold-faint text-[#8a6d1f]' : 'bg-gold-soft text-[#7a5c10]',
                  )}
                >
                  {kindLabel}
                </span>
                <DialogDescription className="text-t12 text-muted-foreground">{dateLine}</DialogDescription>
              </div>
              <DialogTitle className="font-serif text-t20 text-charcoal mt-1.5">{language === 'hi' ? detail.hi : detail.en}</DialogTitle>
            </DialogHeader>
            <div className="px-5 py-4">
              {state === 'loading' && (
                <div className="space-y-2.5 py-1" aria-busy="true">
                  <div className="h-3.5 w-full rounded shimmer" />
                  <div className="h-3.5 w-11/12 rounded shimmer" />
                  <div className="h-3.5 w-4/5 rounded shimmer" />
                  <div className="h-3.5 w-3/5 rounded shimmer" />
                  <p className="text-t12 text-muted-foreground pt-1">{t('panchang.festLoading')}</p>
                </div>
              )}
              {state === 'error' && (
                <ErrorState message={t('common.networkError')} />
              )}
              {state === 'ready' && text && (
                <div className="rounded-xl glass-ink px-4 py-3.5 relative overflow-hidden">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <AcharyaAvatar size={30} />
                    <div>
                      <p className="text-t12 font-semibold text-gold-grad font-serif">Acharya Abhishek Sharma</p>
                      <p className="text-[10px] text-[#a5947a]">{t('panchang.festBy')}</p>
                    </div>
                  </div>
                  <p className="text-t14 leading-relaxed text-[#e8ddc8] whitespace-pre-line">{text}</p>
                </div>
              )}
              {state === 'ready' && text && (
                <button
                  type="button"
                  onClick={() => void toggleAudio()}
                  disabled={audioState === 'loading'}
                  title={t('panchang.festListen')}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold-faint/50 px-3 py-1.5 text-t12 text-gold hover:bg-gold-faint hover:border-gold/50 active:scale-95 transition-all duration-250 disabled:opacity-60"
                >
                  <Icon name="speaker" size={13} className={audioState === 'playing' ? 'animate-pulse' : undefined} />
                  {audioState === 'loading' ? t('acharya.preparingAudio') : audioState === 'playing' ? t('acharya.stopAudio') : t('acharya.listen')}
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
