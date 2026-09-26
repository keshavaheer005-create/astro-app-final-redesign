'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, AcharyaAvatar, MoonPhaseGlyph, type IconName } from '../icons';
import { GlassCard, SectionHeader, GoldButton, ErrorState } from '../ui-primitives';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { api, useSession } from '../session-context';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';

interface CheckinState {
  streak: number;
  checkedInToday: boolean;
  total: number;
  weekEntryCount: number;
  reflection: { weekStartDate: string; reflectionText: string } | null;
}

interface TodayPanchang {
  tithi: { index: number; name: string; nameHi: string; paksha: string; percent: number };
  nakshatra: { name: string; nameHi: string; pada: number };
  sunriseISO: string | null;
  moonriseISO: string | null;
  moonsetISO: string | null;
  moonSign: { name: string; nameHi: string };
}

function phaseKeyOf(p: number): string {
  const b = [
    [0, 'phase.new'], [0.0625, 'phase.waxingCrescent'], [0.1875, 'phase.firstQuarter'],
    [0.3125, 'phase.waxingGibbous'], [0.4375, 'phase.full'], [0.5625, 'phase.waningGibbous'],
    [0.6875, 'phase.lastQuarter'], [0.8125, 'phase.waningCrescent'],
  ] as [number, string][];
  for (let i = b.length - 1; i >= 0; i--) {
    if (p >= b[i][0]) return b[i][1];
  }
  return 'phase.new';
}

export function HomeScreen({ onNavigate }: { onNavigate: (tab: 'kundli' | 'journal' | 'acharya' | 'profile', view?: string) => void }) {
  const { t, i18n } = useTranslation();
  const { chart, user } = useSession();
  const language = useAppStore((s) => s.language);
  const reminderTime = useAppStore((s) => s.reminderTime);
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';

  const [checkin, setCheckin] = useState<CheckinState | null>(null);
  const [checkinError, setCheckinError] = useState(false);
  const [panchang, setPanchang] = useState<TodayPanchang | null>(null);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleLetterAudio = async () => {
    if (audioState === 'playing') {
      audioRef.current?.pause();
      setAudioState('idle');
      return;
    }
    if (audioRef.current) {
      void audioRef.current.play().catch(() => undefined);
      setAudioState('playing');
      return;
    }
    setAudioState('loading');
    try {
      const res = await api<{ audioDataUri: string }>('/api/reflection-audio', { method: 'POST' });
      const audio = new Audio(res.audioDataUri);
      audio.onended = () => setAudioState('idle');
      audioRef.current = audio;
      void audio.play().catch(() => setAudioState('idle'));
      setAudioState('playing');
    } catch {
      setAudioState('idle');
    }
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('greeting.morning');
    if (h < 17) return t('greeting.afternoon');
    if (h < 21) return t('greeting.evening');
    return t('greeting.night');
  })();

  const loadCheckin = useCallback(async () => {
    setCheckinError(false);
    try {
      const res = await api<CheckinState>('/api/checkins');
      setCheckin(res);
    } catch {
      setCheckinError(true);
    }
  }, []);

  useEffect(() => {
    void loadCheckin();
  }, [loadCheckin]);

  useEffect(() => {
    if (!chart) return;
    let cancelled = false;
    const run = async () => {
      try {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const res = await api<{ panchang: TodayPanchang }>('/api/panchang', {
          method: 'POST',
          body: JSON.stringify({ date: dateStr, lat: chart.input.lat, lng: chart.input.lng, timezone: chart.input.timezone }),
        });
        if (!cancelled) setPanchang(res.panchang);
      } catch {
        /* hero panchang is best-effort */
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  const submitCheckin = async () => {
    setSaving(true);
    try {
      await api('/api/checkins', {
        method: 'POST',
        body: JSON.stringify({ moodScore: mood, energyScore: energy, note: note.trim() || null }),
      });
      setJustSaved(true);
      setNote('');
      await loadCheckin();
    } catch {
      /* keep card open */
    } finally {
      setSaving(false);
    }
  };

  const dateLine = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const displayName = chart?.input?.name || user?.name || 'Seeker';

  const features: { sections: { titleKey: string; items: { icon: IconName; titleKey: string; bodyKey: string; view: string }[] }[] } = {
    sections: [
      {
        titleKey: 'home.section.chart',
        items: [
          { icon: 'chart', titleKey: 'home.feature.chart', bodyKey: 'home.feature.chartBody', view: 'chart' },
          { icon: 'timeline', titleKey: 'home.feature.reports', bodyKey: 'home.feature.reportsBody', view: 'reports' },
          { icon: 'shield', titleKey: 'home.feature.dosha', bodyKey: 'home.feature.doshaBody', view: 'reports' },
        ],
      },
      {
        titleKey: 'home.section.predictions',
        items: [
          { icon: 'sparkle', titleKey: 'home.feature.horoscope', bodyKey: 'home.feature.horoscopeBody', view: 'horoscope' },
          { icon: 'handshake', titleKey: 'home.feature.matching', bodyKey: 'home.feature.matchingBody', view: 'matching' },
        ],
      },
      {
        titleKey: 'home.section.tools',
        items: [
          { icon: 'sun', titleKey: 'home.feature.panchang', bodyKey: 'home.feature.panchangBody', view: 'panchang' },
          { icon: 'compass', titleKey: 'home.feature.decision', bodyKey: 'home.feature.decisionBody', view: 'decision' },
        ],
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-t14 text-muted-foreground">{greeting},</p>
          <h1 className="font-serif text-t28 font-bold text-charcoal truncate">{displayName}</h1>
          <p className="text-t12 text-muted-foreground mt-0.5">{dateLine}</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t('home.headerBell')}
              className="relative w-11 h-11 rounded-full glass inline-flex items-center justify-center text-gold hover:scale-105 active:scale-95 transition-transform duration-250"
            >
              <Icon name="bell" size={20} />
              {((checkin && !checkin.checkedInToday) || checkin?.reflection) && (
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-maroon animate-pulse" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={10} className="w-72 glass border-gold/30 p-0 overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-gold/15 bg-gold-faint/60">
              <p className="text-t12 font-bold uppercase tracking-wider text-gold">{t('notifications.title')}</p>
            </div>
            <div className="max-h-72 overflow-y-auto scroll-slim">
              {checkin && !checkin.checkedInToday && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.body.click();
                  }}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gold-soft/50 transition-colors duration-150 border-b border-gold/10"
                >
                  <span className="mt-0.5 text-maroon"><Icon name="check" size={15} /></span>
                  <span>
                    <span className="block text-t14 text-charcoal">{t('notifications.checkinDue')}</span>
                    <span className="block text-t12 text-muted-foreground">{t('notifications.reminderSet', { time: reminderTime })}</span>
                  </span>
                </button>
              )}
              {checkin?.reflection && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLetterOpen(true);
                    document.body.click();
                  }}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gold-soft/50 transition-colors duration-150 border-b border-gold/10"
                >
                  <span className="mt-0.5 text-gold"><Icon name="journal" size={15} /></span>
                  <span className="text-t14 text-charcoal">{t('notifications.reflectionReady')}</span>
                </button>
              )}
              {checkin && checkin.streak >= 3 && (
                <div className="px-4 py-3 flex items-start gap-3 border-b border-gold/10">
                  <span className="mt-0.5 text-maroon"><Icon name="flame" size={15} /></span>
                  <span className="text-t14 text-charcoal">{t('notifications.streak', { n: checkin.streak })}</span>
                </div>
              )}
              {checkin?.checkedInToday && !checkin.reflection && (checkin?.streak ?? 0) < 3 && (
                <div className="px-4 py-6 text-center">
                  <p className="text-t12 text-muted-foreground">{t('notifications.none')}</p>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </header>

      {/* Hero: today's panchang + Acharya CTA */}
      <GlassCard className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-t12 uppercase tracking-wider text-gold font-semibold">{t('home.heroTitle')}</p>
            {panchang ? (
              <div className="mt-2.5 space-y-1.5">
                <p className="text-t16 text-charcoal">
                  <span className="font-semibold">{t('home.tithi')}:</span>{' '}
                  {language === 'hi' ? `${panchang.tithi.paksha === 'Shukla' ? 'शुक्ल' : 'कृष्ण'} ${panchang.tithi.nameHi}` : `${panchang.tithi.paksha} ${panchang.tithi.name}`}
                </p>
                <p className="text-t14 text-charcoal/80">
                  <span className="font-semibold">{t('home.nakshatra')}:</span>{' '}
                  {language === 'hi' ? panchang.nakshatra.nameHi : panchang.nakshatra.name} · {panchang.moonSign.nameHi ?? ''} {language !== 'hi' ? panchang.moonSign.name : ''}
                </p>
                {panchang.sunriseISO && (
                  <p className="text-t12 text-muted-foreground inline-flex items-center gap-1.5">
                    <Icon name="sunrise" size={13} className="text-gold" />
                    {t('home.sunrise')}: {new Date(panchang.sunriseISO).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: chart.input.timezone })}
                  </p>
                )}
                {(panchang.moonriseISO || panchang.moonsetISO) && (
                  <p className="text-t12 text-muted-foreground inline-flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="moonrise" size={13} className="text-gold" />
                      {t('home.moonrise')}: {panchang.moonriseISO ? new Date(panchang.moonriseISO).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: chart.input.timezone }) : '—'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="moonset" size={13} className="text-gold" />
                      {t('home.moonset')}: {panchang.moonsetISO ? new Date(panchang.moonsetISO).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: chart.input.timezone }) : '—'}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-2.5 space-y-2">
                <div className="h-4 w-44 rounded shimmer" />
                <div className="h-4 w-36 rounded shimmer" />
              </div>
            )}
          </div>
          <span className="shrink-0 hidden sm:flex flex-col items-center gap-1">
            {panchang && (
              <MoonPhaseGlyph phase={((panchang.tithi.index - 1) + panchang.tithi.percent / 100) / 30} size={38} />
            )}
            {panchang && (
              <span className="text-t12 text-muted-foreground">{t(phaseKeyOf(((panchang.tithi.index - 1) + panchang.tithi.percent / 100) / 30))}</span>
            )}
            {!panchang && <Icon name="sun" size={40} strokeWidth={1.2} className="text-gold/70" />}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('acharya')}
          className="mt-4 w-full glass-ink rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left transition-transform duration-250 ease-out hover:-translate-y-0.5 active:scale-[0.99] group"
        >
          <AcharyaAvatar size={44} className="shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-t14 font-semibold text-gold-grad font-serif">{t('home.talkToAcharya')}</span>
            <span className="block text-t12 text-[#cdb98e] truncate">{t('home.acharyaByline')}</span>
          </span>
          <Icon name="chevron-right" size={18} className="text-gold transition-transform duration-250 group-hover:translate-x-0.5" />
        </button>
      </GlassCard>

      {/* Daily check-in */}
      <GlassCard className="p-5 sm:p-6">
        <AnimatePresence mode="wait">
          {checkin?.checkedInToday ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-4"
            >
              <span className="shrink-0 w-12 h-12 rounded-full gold-grad flex items-center justify-center text-charcoal">
                <Icon name="check" size={24} strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-t16 font-semibold text-charcoal">{t('home.checkinDone')}</p>
                <p className="text-t12 text-muted-foreground">{t('home.checkinDoneBody')}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1 text-maroon font-semibold text-t16">
                  <Icon name="flame" size={18} />
                  {checkin.streak}
                </span>
                <p className="text-t12 text-muted-foreground">{t('home.streak', { n: checkin.streak })}</p>
              </div>
            </motion.div>
          ) : checkinError ? (
            <ErrorState message={t('common.networkError')} onRetry={loadCheckin} />
          ) : !checkin ? (
            <div className="space-y-3 py-2">
              <div className="h-5 w-40 rounded shimmer" />
              <div className="h-9 rounded-xl shimmer" />
              <div className="h-9 rounded-xl shimmer" />
            </div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }}>
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-t20 font-semibold text-charcoal">{t('home.checkinTitle')}</h2>
                <span className="inline-flex items-center gap-1 text-t12 text-muted-foreground">
                  <Icon name="flame" size={14} className="text-gold" />
                  {checkin.streak > 0 ? t('home.streak', { n: checkin.streak }) : t('home.streakNew')}
                </span>
              </div>

              <div className="mt-4 space-y-4">
                <MoodSlider
                  label={t('home.mood')}
                  value={mood}
                  onChange={setMood}
                  lowLabel={language === 'hi' ? 'भारी' : 'Heavy'}
                  highLabel={language === 'hi' ? 'उजला' : 'Bright'}
                />
                <MoodSlider
                  label={t('home.energy')}
                  value={energy}
                  onChange={setEnergy}
                  lowLabel={language === 'hi' ? 'थकान' : 'Drained'}
                  highLabel={language === 'hi' ? 'जोश' : 'Charged'}
                />
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('home.notePlaceholder')}
                  rows={2}
                  className="resize-none rounded-xl border-gold/25 bg-white/70 text-t14 focus-visible:ring-gold/30 max-h-24"
                  maxLength={280}
                />
                {mood <= 2 && <p className="text-t12 text-maroon/80 italic">{t('home.checkinLow')}</p>}
                <GoldButton onClick={submitCheckin} disabled={saving} className="w-full">
                  {saving ? t('common.loading') : justSaved ? t('common.saved') : t('home.checkinSubmit')}
                  {!saving && <Icon name="check" size={16} />}
                </GoldButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Weekly reflection letter (ink card) */}
      <div>
        <SectionHeader title={t('home.weeklyTitle')} icon="journal" />
        <GlassCard ink className="p-5 sm:p-6">
          {checkin?.reflection ? (
            <>
              <button type="button" onClick={() => setLetterOpen((v) => !v)} className="w-full text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-t12 uppercase tracking-wider text-gold font-semibold">{t('home.weeklyReady')}</p>
                    <p className="font-serif text-t20 mt-1 text-[#f0e4c3] truncate">
                      {checkin.reflection.reflectionText.split('\n')[0].slice(0, 80)}…
                    </p>
                  </div>
                  <Icon name="chevron-down" size={20} className={cn('text-gold transition-transform duration-250 shrink-0', letterOpen && 'rotate-180')} />
                </div>
              </button>
              <AnimatePresence>
                {letterOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <p className="mt-4 whitespace-pre-wrap text-t14 leading-relaxed text-[#e8dcbf] letter-body">
                      {checkin.reflection.reflectionText}
                    </p>
                    <button
                      type="button"
                      onClick={toggleLetterAudio}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold/15 border border-gold/40 px-4 py-1.5 text-t12 font-medium text-gold-light hover:bg-gold/25 active:scale-95 transition-all duration-250"
                    >
                      <Icon name={audioState === 'playing' ? 'pause' : 'speaker'} size={14} />
                      {audioState === 'loading' ? t('letter.loadingAudio') : audioState === 'playing' ? t('letter.stop') : t('letter.listen')}
                      {audioState === 'loading' && <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <span className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/15 text-gold">
                <Icon name="journal" size={22} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-t14 text-[#e8dcbf]">{t('home.weeklyEmpty')}</p>
                {checkin && (
                  <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full gold-grad rounded-full transition-[width] duration-500"
                      style={{ width: `${Math.min(100, (checkin.weekEntryCount / 3) * 100)}%` }}
                    />
                  </div>
                )}
                {checkin && <p className="mt-1 text-t12 text-[#a5947a]">{t('home.weeklyProgress', { n: checkin.weekEntryCount })}</p>}
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Feature grid */}
      {!chart && (
        <GlassCard className="p-5 flex items-center gap-4 border-maroon/25">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-maroon-soft text-maroon shrink-0">
            <Icon name="warning" size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-t14 font-semibold text-charcoal">{t('home.noChart')}</p>
            <p className="text-t12 text-muted-foreground">{t('home.noChartBody')}</p>
          </div>
          <GoldButton onClick={() => onNavigate('profile')} className="shrink-0 h-9 px-4 text-t12">{t('profile.addChart')}</GoldButton>
        </GlassCard>
      )}

      {features.sections.map((section, si) => (
        <section key={section.titleKey} aria-label={t(section.titleKey)}>
          {si > 0 && <div className="ornament-divider my-6">✦</div>}
          <SectionHeader title={t(section.titleKey)} />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {section.items.map((item) => (
              <GlassCard
                key={item.titleKey}
                onClick={() => onNavigate('kundli', item.view)}
                className="p-4 sm:p-5 group"
              >
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold-soft/80 text-gold transition-all duration-250 group-hover:gold-grad group-hover:text-charcoal">
                  <Icon name={item.icon} size={20} />
                </span>
                <p className="mt-3 text-t14 font-semibold text-charcoal">{t(item.titleKey)}</p>
                <p className="text-t12 text-muted-foreground mt-0.5 leading-snug">{t(item.bodyKey)}</p>
              </GlassCard>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MoodSlider({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-t14 font-medium text-charcoal">{label}</span>
        <span className="text-t12 text-muted-foreground">{value}/5</span>
      </div>
      <Slider
        value={[value]}
        min={1}
        max={5}
        step={1}
        onValueChange={(v) => onChange(v[0])}
        className="[&_[data-slot=slider-track]]:bg-gold/20 [&_[data-slot=slider-range]]:bg-gold"
      />
      <div className="flex justify-between mt-1">
        <span className="text-t12 text-muted-foreground/70">{lowLabel}</span>
        <span className="text-t12 text-muted-foreground/70">{highLabel}</span>
      </div>
    </div>
  );
}
