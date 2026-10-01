'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, AcharyaAvatar, MoonPhaseGlyph, type IconName } from '../icons';
import { GlassCard, SectionHeader, GoldButton, ErrorState } from '../ui-primitives';
import { MandalaAccent } from '../chakra';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { api, useSession } from '../session-context';
import { useAppStore } from '@/store/app';
import { cn, choghName } from '@/lib/utils';

interface CheckinState {
  streak: number;
  checkedInToday: boolean;
  total: number;
  weekEntryCount: number;
  reflection: { weekStartDate: string; reflectionText: string; language?: string } | null;
}

interface TodayPanchang {
  tithi: { index: number; name: string; nameHi: string; paksha: string; percent: number };
  nakshatra: { name: string; nameHi: string; pada: number };
  sunriseISO: string | null;
  moonriseISO: string | null;
  moonsetISO: string | null;
  moonSign: { name: string; nameHi: string };
  choghadiya?: {
    day: { name: string; quality: 'good' | 'medium' | 'bad'; startISO: string; endISO: string }[];
    night: { name: string; quality: 'good' | 'medium' | 'bad'; startISO: string; endISO: string }[];
  };
  rahuKaal?: { startISO: string | null; endISO: string | null };
}

interface DashaNow {
  mahaLord: string;
  antarLord: string | null;
  antarEnd: string;
  antarPercent: number;
  next: { lord: string | null; isMahaChange: boolean; dateISO: string; daysLeft: number };
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

/**
 * Live "right now" strip for the Home hero: current Choghadiya slot with a
 * ticking countdown + progress, and a Rahu-Kaal warning while it is active.
 * Ticks locally (1s) without re-rendering the parent screen.
 */
function LiveNowStrip({ choghadiya, rahuKaal, tz, locale }: {
  choghadiya: NonNullable<TodayPanchang['choghadiya']>;
  rahuKaal: TodayPanchang['rahuKaal'];
  tz: string;
  locale: string;
}) {
  const { t } = useTranslation();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const slots = [...choghadiya.day, ...choghadiya.night];
  const cur = slots.find((s) => new Date(s.startISO).getTime() <= now && new Date(s.endISO).getTime() > now);
  const rahuStart = rahuKaal?.startISO ? new Date(rahuKaal.startISO).getTime() : null;
  const rahuEnd = rahuKaal?.endISO ? new Date(rahuKaal.endISO).getTime() : null;
  const rahuActive = rahuStart != null && rahuEnd != null && rahuStart <= now && rahuEnd > now;
  if (!cur && !rahuActive) return null;

  const start = cur ? new Date(cur.startISO).getTime() : 0;
  const end = cur ? new Date(cur.endISO).getTime() : 0;
  const pct = cur ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0;
  const remMs = Math.max(0, end - now);
  const remStr = remMs >= 3600_000
    ? `${Math.floor(remMs / 3600_000)}h ${Math.floor((remMs % 3600_000) / 60_000)}m`
    : `${Math.floor(remMs / 60_000)}m ${String(Math.floor((remMs % 60_000) / 1000)).padStart(2, '0')}s`;
  const fmtT = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: tz });

  return (
    <div className="mt-3.5 pt-3 border-t border-gold/15" data-testid="live-now-strip">
      {cur && (
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
            </span>
            <span className="text-t12 font-bold uppercase tracking-wider text-gold">{t('home.liveTitle')}</span>
          </span>
          <span className="font-serif text-t16 font-semibold text-charcoal">{choghName(t, cur.name)}</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-t12 font-semibold',
              cur.quality === 'good' ? 'bg-gold-faint text-[#7a8b6f]' : cur.quality === 'medium' ? 'bg-white/60 text-muted-foreground' : 'bg-burgundy-soft text-burgundy',
            )}
          >
            {t(`choghadiya.${cur.quality}`)}
          </span>
          <span className="text-t12 text-muted-foreground tabular-nums">{t('home.liveEndsIn', { time: remStr })}</span>
        </div>
      )}
      {cur && (
        <div className="mt-2 h-1 rounded-full bg-gold/15 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full gold-grad rounded-full" style={{ width: `${pct}%`, transition: 'width 1s linear' }} />
        </div>
      )}
      {rahuActive && rahuEnd && (
        <p className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-t12 font-semibold bg-burgundy-soft text-burgundy border border-burgundy/25', cur && 'mt-2')}>
          <Icon name="warning" size={13} />
          {t('home.liveRahu', { time: fmtT(rahuKaal?.endISO as string) })}
        </p>
      )}
    </div>
  );
}

/** One upcoming sky event for the "Sky ahead" strip (see /api/sky-highlights). */
interface SkyItem {
  date: string;
  kind: 'purnima' | 'amavasya' | 'ekadashi' | 'sankranti' | 'festival';
  name: { en: string; hi: string };
  daysUntil: number;
}

const SKY_ICON: Record<SkyItem['kind'], IconName> = {
  purnima: 'moon',
  amavasya: 'moon',
  ekadashi: 'lotus',
  sankranti: 'sun',
  festival: 'om',
};

/** localStorage key holding ids of sky notifications the user has opened. */
const SKY_SEEN_KEY = 'ss-sky-seen-v1';

function readSkySeen(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(SKY_SEEN_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistSkySeen(ids: Set<string>) {
  try {
    // keep the newest 60 entries only
    const arr = [...ids].slice(-60);
    window.localStorage.setItem(SKY_SEEN_KEY, JSON.stringify(arr));
  } catch {
    /* private mode — unread state simply won't persist */
  }
}

/** Stable unread id for a sky notification (date + kind + en name). */
function skyNotifId(item: SkyItem): string {
  return `${item.date}|${item.kind}|${item.name.en}`;
}

export function HomeScreen({ onNavigate }: { onNavigate: (tab: 'kundli' | 'journal' | 'acharya' | 'profile', view?: string) => void }) {
  const { t, i18n } = useTranslation();
  const { chart, user } = useSession();
  const { toast } = useToast();
  const language = useAppStore((s) => s.language);
  const reminderTime = useAppStore((s) => s.reminderTime);
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';

  const [checkin, setCheckin] = useState<CheckinState | null>(null);
  const [checkinError, setCheckinError] = useState(false);
  const [panchang, setPanchang] = useState<TodayPanchang | null>(null);
  const [dashaNow, setDashaNow] = useState<DashaNow | null>(null);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [reminderAlert, setReminderAlert] = useState(false);
  const [letterAlert, setLetterAlert] = useState(false); // a new letter just landed
  const [sky, setSky] = useState<SkyItem[] | null>(null);
  const [skySeen, setSkySeen] = useState<Set<string>>(() => readSkySeen());
  const [flashCheckin, setFlashCheckin] = useState(false);
  const [flashLetter, setFlashLetter] = useState(false);
  const pendingFocus = useAppStore((s) => s.pendingFocus);

  // Scroll to the check-in card and pulse it (used by the bell item and the
  // reminder toast's "Check in now" action via the pendingFocus handoff).
  const focusCheckin = React.useCallback(() => {
    document.getElementById('daily-checkin')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashCheckin(true);
    window.setTimeout(() => setFlashCheckin(false), 1800);
  }, []);

  // Scroll to the weekly letter, open it and pulse it ("Read the letter"
  // toast action / bell item). Clears the "new letter" bell dot.
  const focusLetter = React.useCallback(() => {
    document.getElementById('weekly-letter')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setLetterOpen(true);
    setLetterAlert(false);
    setFlashLetter(true);
    window.setTimeout(() => setFlashLetter(false), 1800);
  }, []);

  // One-shot focus handoff from the reminder toast (works even if Home was
  // not mounted when the toast action fired).
  useEffect(() => {
    if (pendingFocus === 'checkin') {
      useAppStore.getState().consumePendingFocus();
      focusCheckin();
    } else if (pendingFocus === 'letter') {
      useAppStore.getState().consumePendingFocus();
      focusLetter();
    }
  }, [pendingFocus, focusCheckin, focusLetter]);

  // Reminder scheduler handshake → bell dot + wiggle
  useEffect(() => {
    const onFire = () => setReminderAlert(true);
    window.addEventListener('ss:reminder-fired', onFire);
    return () => window.removeEventListener('ss:reminder-fired', onFire);
  }, []);
  useEffect(() => {
    if (checkin?.checkedInToday) setReminderAlert(false);
  }, [checkin?.checkedInToday]);
  // Reading the letter by any route clears the "new letter" bell dot
  useEffect(() => {
    if (letterOpen && letterAlert) setLetterAlert(false);
  }, [letterOpen, letterAlert]);

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
      const res = await api<{ audioDataUri: string }>('/api/reflection-audio', {
        method: 'POST',
        body: JSON.stringify({ language }),
      });
      const audio = new Audio(res.audioDataUri);
      audio.onended = () => setAudioState('idle');
      audioRef.current = audio;
      void audio.play().catch(() => setAudioState('idle'));
      setAudioState('playing');
    } catch {
      setAudioState('idle');
    }
  };

  // Sky-ahead bell notifications: events within the next 14 days (one paksha)
  // become bell items. Unread state persists in localStorage (per event id),
  // so the dot survives reloads until the user opens each one.
  const skyNotifs = (sky ?? []).filter((s) => s.daysUntil >= 0 && s.daysUntil <= 14);
  const skyUnreadCount = skyNotifs.filter((s) => !skySeen.has(skyNotifId(s))).length;
  const markSkySeen = useCallback((id: string) => {
    setSkySeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistSkySeen(next);
      return next;
    });
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('greeting.morning');
    if (h < 17) return t('greeting.afternoon');
    if (h < 21) return t('greeting.evening');
    return t('greeting.night');
  })();

  // Letterhead: localized "Week of Mon – Sun" range for the current letter
  const weekRangeLabel = (() => {
    if (!checkin?.reflection) return '';
    const start = new Date(`${checkin.reflection.weekStartDate}T12:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return t('home.weekOf', { range: `${fmt(start)} – ${fmt(end)}` });
  })();

  const loadCheckin = useCallback(async () => {
    setCheckinError(false);
    try {
      const res = await api<CheckinState>(`/api/checkins?lang=${language}`);
      setCheckin(res);
    } catch {
      setCheckinError(true);
    }
  }, [language]);

  useEffect(() => {
    void loadCheckin();
  }, [loadCheckin]);

  // Lazy weekly-letter warm-up: when this week has ≥3 check-ins but no letter
  // in the ACTIVE language yet, ask the API to generate one, then reload.
  // (The generation route is a lazy scheduled job — it must be requested.)
  // When a NEW letter actually lands, celebrate it once: bell dot + a toast
  // with a "Read the letter" action (in-app notification, no push needed).
  const letterTriedRef = useRef<Set<string>>(new Set());
  const hadLetterRef = useRef(false);
  useEffect(() => {
    if (!checkin || checkin.weekEntryCount < 3) return;
    if (checkin.reflection && checkin.reflection.language === language) {
      hadLetterRef.current = true; // letter existed before this mount — no celebration
      return;
    }
    const key = `${language}|${checkin.reflection?.weekStartDate ?? 'none'}`;
    if (letterTriedRef.current.has(key)) return; // one attempt per language per mount
    letterTriedRef.current.add(key);
    let cancelled = false;
    const run = async () => {
      try {
        await api(`/api/weekly-reflection?lang=${language}`);
        if (!cancelled) {
          void loadCheckin();
          if (!hadLetterRef.current) {
            hadLetterRef.current = true; // fire exactly once per mount
            setLetterAlert(true);
            toast({
              title: t('notifications.letterToastTitle'),
              description: t('notifications.letterToastBody'),
              duration: 12000,
              action: (
                <ToastAction
                  altText={t('notifications.letterToastAction')}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('ss:navigate', { detail: { tab: 'home' } }));
                    useAppStore.getState().pushPendingFocus('letter');
                  }}
                >
                  {t('notifications.letterToastAction')}
                </ToastAction>
              ),
            });
          }
        }
      } catch {
        /* letter simply stays absent until next visit */
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [checkin, language, loadCheckin, toast, t]);

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

  // Sky ahead — upcoming purnima / ekadashi / sankranti / festivals (best-effort)
  useEffect(() => {
    if (!chart) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api<{ items: SkyItem[] }>(
          `/api/sky-highlights?lat=${chart.input.lat}&lng=${chart.input.lng}&timezone=${encodeURIComponent(chart.input.timezone)}`,
        );
        if (!cancelled) setSky(res.items ?? []);
      } catch {
        /* strip is best-effort */
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  useEffect(() => {
    if (!chart) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api<{ dasha: DashaNow }>('/api/dasha-now');
        if (!cancelled) setDashaNow(res.dasha);
      } catch {
        /* dasha card is best-effort */
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  const submitCheckin = async () => {
    setSaving(true);
    setCheckinError(false);
    try {
      await api('/api/checkins', {
        method: 'POST',
        body: JSON.stringify({ moodScore: mood, energyScore: energy, note: note.trim() || null }),
      });
      setJustSaved(true);
      setNote('');
      await loadCheckin();
    } catch {
      // Never silent — tell the user the save failed so they can retry.
      setCheckinError(true);
    } finally {
      setSaving(false);
    }
  };

  const dateLine = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const displayName = chart?.input?.name || user?.name || 'Seeker';
  // Moon phase 0→1 for the at-a-glance strip (same formula as the hero glyph)
  const moonPhase = panchang ? ((panchang.tithi.index - 1) + panchang.tithi.percent / 100) / 30 : null;

  // Shortcut tile tints — one accent domain per destination (gold stays CTA-only).
  // `chipGrad` fills the icon badge with a soft two-tone gradient (no hairline
  // border — a border on a small circular chip reads as a cheap outline-icon
  // kit; a gradient fill reads as a premium, tactile mark instead).
  const QUICK_TONES = [
    { chipGrad: 'linear-gradient(150deg, rgba(110,74,158,0.16), rgba(110,74,158,0.05))', text: 'text-violet-deep' }, // Ask Acharya
    { chipGrad: 'linear-gradient(150deg, rgba(201,162,39,0.20), rgba(201,162,39,0.06))', text: 'text-gold' }, // Today's Panchang
    { chipGrad: 'linear-gradient(150deg, rgba(194,69,90,0.16), rgba(194,69,90,0.05))', text: 'text-rose-deep' }, // Decision check
    { chipGrad: 'linear-gradient(150deg, rgba(62,142,110,0.18), rgba(62,142,110,0.06))', text: 'text-emerald-deep' }, // My journal
  ];

  // One-tap shortcuts to the most-used destinations (no new backend calls)
  const quickActions: { icon: IconName; labelKey: string; go: () => void }[] = [
    { icon: 'chat', labelKey: 'home.quick.acharya', go: () => onNavigate('acharya') },
    { icon: 'sun', labelKey: 'home.quick.panchang', go: () => onNavigate('kundli', 'panchang') },
    { icon: 'compass', labelKey: 'home.quick.decision', go: () => onNavigate('kundli', 'decision') },
    { icon: 'journal', labelKey: 'home.quick.journal', go: () => onNavigate('journal') },
  ];

  const features: { sections: { titleKey: string; tone: 'gold' | 'rose' | 'violet'; items: { icon: IconName; titleKey: string; bodyKey: string; view: string }[] }[] } = {
    sections: [
      {
        titleKey: 'home.section.chart',
        tone: 'gold',
        items: [
          { icon: 'chart', titleKey: 'home.feature.chart', bodyKey: 'home.feature.chartBody', view: 'chart' },
          { icon: 'timeline', titleKey: 'home.feature.reports', bodyKey: 'home.feature.reportsBody', view: 'reports' },
          { icon: 'shield', titleKey: 'home.feature.dosha', bodyKey: 'home.feature.doshaBody', view: 'reports' },
        ],
      },
      {
        titleKey: 'home.section.predictions',
        tone: 'rose',
        items: [
          { icon: 'sparkle', titleKey: 'home.feature.horoscope', bodyKey: 'home.feature.horoscopeBody', view: 'horoscope' },
          { icon: 'handshake', titleKey: 'home.feature.matching', bodyKey: 'home.feature.matchingBody', view: 'matching' },
        ],
      },
      {
        titleKey: 'home.section.tools',
        tone: 'violet',
        items: [
          { icon: 'sun', titleKey: 'home.feature.panchang', bodyKey: 'home.feature.panchangBody', view: 'panchang' },
          { icon: 'compass', titleKey: 'home.feature.decision', bodyKey: 'home.feature.decisionBody', view: 'decision' },
        ],
      },
    ],
  };

  return (
    <div className="relative space-y-6">
      {/* Full-viewport gold gradient comes from ScreenGradient (app-shell) */}

      {/* Cohesive header band — greeting, date and the at-a-glance stats read
          as ONE premium unit: gold-tinted liquid glass, dawn glow and a slowly
          turning mandala watermark instead of two disconnected pieces. */}
      <header
        className="glass glass-tint-gold glass-liquid relative overflow-hidden rounded-[26px] px-5 pt-5 pb-3.5 sm:px-6 sm:pt-6 sm:pb-4 stagger-in"
        style={{ animationDelay: '10ms', animationFillMode: 'backwards' }}
      >
        {/* dawn glow + mandala watermark (decorative, non-interactive) */}
        <div className="pointer-events-none absolute -top-20 -right-14 h-52 w-52 rounded-full bg-gold/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-gold-soft/50 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -top-10 -right-9 text-gold opacity-[0.09]" aria-hidden="true">
          <MandalaAccent size={148} className="chakra-spin-zodiac" />
        </div>

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-t14 font-medium text-muted-foreground">{greeting},</p>
            <h1 className="font-serif text-t28 font-bold text-gold-grad truncate leading-tight">{displayName}</h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-t12 text-muted-foreground">
              <Icon name="sun" size={12} className="text-gold/80" />
              {dateLine}
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t('home.headerBell')}
                className={cn(
                  'relative w-11 h-11 shrink-0 rounded-full bg-white/70 border border-gold/25 shadow-[0_2px_10px_rgba(201,162,39,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] inline-flex items-center justify-center text-gold hover:scale-105 active:scale-95 transition-transform duration-250',
                  reminderAlert && 'bell-wiggle',
                )}
              >
                <Icon name="bell" size={20} />
                {((checkin && !checkin.checkedInToday) || letterAlert || reminderAlert || skyUnreadCount > 0) && (
                  <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-maroon animate-pulse" />
                )}
              </button>
            </PopoverTrigger>
          <PopoverContent align="end" sideOffset={10} className="w-72 glass border-gold/30 p-0 overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-gold/15 bg-gold-faint/60 bar-texture-solid">
              <p className="text-t12 font-bold uppercase tracking-wider text-gold">{t('notifications.title')}</p>
            </div>
            <div className="max-h-72 overflow-y-auto scroll-slim">
              {checkin && !checkin.checkedInToday && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.body.click();
                    focusCheckin();
                  }}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gold-soft/50 transition-colors duration-150 border-b border-gold/10 animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
                  style={{ animationDelay: '0ms', animationFillMode: 'backwards' }}
                >
                  <span className="mt-0.5 text-burgundy"><Icon name="check" size={15} /></span>
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
                    document.body.click();
                    focusLetter();
                  }}
                  className={cn(
                    'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors duration-150 border-b border-gold/10 animate-in fade-in-0 slide-in-from-bottom-1 duration-300',
                    letterAlert ? 'bg-gold-soft/70 hover:bg-gold-soft' : 'hover:bg-gold-soft/50',
                  )}
                  style={{ animationDelay: '50ms', animationFillMode: 'backwards' }}
                >
                  <span className={cn('mt-0.5', letterAlert ? 'text-violet' : 'text-violet/70')}><Icon name="journal" size={15} /></span>
                  <span className="min-w-0">
                    <span className={cn('block text-t14', letterAlert ? 'font-semibold text-charcoal' : 'text-charcoal')}>
                      {t(letterAlert ? 'notifications.reflectionNew' : 'notifications.reflectionReady')}
                    </span>
                    {letterAlert && <span className="block text-t12 text-muted-foreground">{t('notifications.reflectionNewBody')}</span>}
                  </span>
                  {letterAlert && <span className="ml-auto shrink-0 mt-0.5 w-2 h-2 rounded-full bg-gold animate-pulse" aria-hidden />}
                </button>
              )}
              {dashaNow?.next.lord && dashaNow.next.daysLeft <= 7 && dashaNow.next.daysLeft >= 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.body.click();
                    onNavigate('kundli', 'reports');
                  }}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gold-soft/50 transition-colors duration-150 border-b border-gold/10 animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
                  style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}
                >
                  <span className="mt-0.5 text-gold"><Icon name="clock" size={15} /></span>
                  <span>
                    <span className="block text-t14 text-charcoal">
                      {dashaNow.next.isMahaChange
                        ? t('notifications.dashaMahaAhead', { next: t(`planet.${dashaNow.next.lord}`), n: dashaNow.next.daysLeft })
                        : t('notifications.dashaAhead', { next: t(`planet.${dashaNow.next.lord}`), n: dashaNow.next.daysLeft })}
                    </span>
                    <span className="block text-t12 text-muted-foreground">{t('notifications.dashaAheadBody')}</span>
                  </span>
                </button>
              )}
              {skyNotifs.map((item, i) => {
                const id = skyNotifId(item);
                const unread = !skySeen.has(id);
                const whenLabel =
                  item.daysUntil === 0 ? t('home.today') : item.daysUntil === 1 ? t('home.tomorrow') : t('home.inDays', { n: item.daysUntil });
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.body.click();
                      markSkySeen(id);
                      useAppStore.getState().pushPendingFocus(`panchang:${item.date}`);
                      onNavigate('kundli', 'panchang');
                    }}
                    className={cn(
                      'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors duration-150 border-b border-gold/10 animate-in fade-in-0 slide-in-from-bottom-1 duration-300',
                      unread ? 'bg-gold-faint/60 hover:bg-gold-faint' : 'hover:bg-gold-soft/50',
                    )}
                    style={{ animationDelay: `${150 + Math.min(i, 6) * 50}ms`, animationFillMode: 'backwards' }}
                  >
                    <span className={cn('mt-0.5 shrink-0', unread ? 'text-gold' : 'text-gold/70')}><Icon name={SKY_ICON[item.kind]} size={15} /></span>
                    <span className="min-w-0">
                      <span className={cn('block text-t14 truncate', unread ? 'font-semibold text-charcoal' : 'text-charcoal/85')}>
                        {language === 'hi' ? item.name.hi : item.name.en}
                      </span>
                      <span className="block text-t12 text-muted-foreground">
                        {new Date(`${item.date}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                        <span className="text-gold"> · {whenLabel}</span>
                      </span>
                    </span>
                    {unread && <span className="ml-auto shrink-0 mt-0.5 w-2 h-2 rounded-full bg-gold animate-pulse" aria-hidden />}
                  </button>
                );
              })}
              {checkin && checkin.streak >= 3 && (
                <div className="px-4 py-3 flex items-start gap-3 border-b border-gold/10 animate-in fade-in-0 slide-in-from-bottom-1 duration-300" style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}>
                  <span className="mt-0.5 text-emerald-deep"><Icon name="flame" size={15} /></span>
                  <span className="text-t14 text-charcoal">{t('notifications.streak', { n: checkin.streak })}</span>
                </div>
              )}
              {checkin?.checkedInToday && !checkin.reflection && (checkin?.streak ?? 0) < 3 && skyNotifs.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <p className="text-t12 text-muted-foreground">{t('notifications.none')}</p>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        </div>

        {/* At a glance — streak · antardasha · moon phase, fused into the same
            band behind a soft hairline so the whole top reads as one header */}
        <section
          aria-label={t('home.glance.aria')}
          className="relative mt-4 flex items-stretch gap-1 border-t border-gold/20 pt-3"
        >
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-1">
            <p className="text-[9.5px] sm:text-[10.5px] uppercase tracking-[0.03em] leading-[1.25] text-muted-foreground/85 [overflow-wrap:anywhere]">{t('home.glance.streak')}</p>
            <p className="inline-flex items-center gap-1.5 text-t16 font-semibold text-emerald-deep">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-soft/90">
                <Icon name="flame" size={12} className="flame-pulse" />
              </span>
              {checkin ? checkin.streak : '—'}
            </p>
          </div>
          <div className="w-px bg-gold/20" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-1">
            <p className="text-[9.5px] sm:text-[10.5px] uppercase tracking-[0.03em] leading-[1.25] text-muted-foreground/85 [overflow-wrap:anywhere]">{t('home.glance.dasha')}</p>
            <p className="inline-flex items-center gap-1.5 text-t16 font-semibold text-gold tabular-nums">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold-soft/90">
                <Icon name="timeline" size={12} />
              </span>
              {dashaNow ? `${dashaNow.antarPercent}%` : '—'}
            </p>
          </div>
          <div className="w-px bg-gold/20" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-1">
            <p className="text-[9.5px] sm:text-[10.5px] uppercase tracking-[0.03em] leading-[1.25] text-muted-foreground/85 [overflow-wrap:anywhere]">{t('home.glance.moon')}</p>
            {moonPhase !== null ? (
              <p className="inline-flex items-center gap-1 text-t12 font-semibold text-violet-deep">
                <MoonPhaseGlyph phase={moonPhase} size={16} className="shrink-0" />
                <span className="min-w-0 leading-[1.2]">{t(phaseKeyOf(moonPhase))}</span>
              </p>
            ) : (
              <p className="text-t16 font-semibold text-muted-foreground">—</p>
            )}
          </div>
        </section>
      </header>

      {/* Shortcuts — ONE unified liquid-glass strip (matches the bottom nav's
          floating-bar language), four columns in a single horizontal row on
          every width. No hairline borders anywhere in here — icon badges are
          soft gradient fills, and the strip itself carries the only edge. */}
      <nav
        aria-label={t('home.quick.aria')}
        className="glass glass-liquid bar-texture stagger-in grid grid-cols-4 gap-1 rounded-[24px] px-1.5 py-2.5 sm:px-2.5 sm:py-3"
        style={{ animationDelay: '20ms', animationFillMode: 'backwards' }}
      >
        {quickActions.map((qa, i) => (
          <button
            key={qa.labelKey}
            type="button"
            onClick={qa.go}
            style={{ animationDelay: `${30 + i * 45}ms`, animationFillMode: 'backwards' }}
            className="tap-sm group relative flex flex-col items-center gap-1.5 rounded-[16px] py-1.5 text-center transition-transform duration-250 ease-out active:scale-[0.94]"
          >
            <span
              className={cn(
                'inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full transition-transform duration-250 group-hover:scale-110 group-active:scale-95',
                QUICK_TONES[i % QUICK_TONES.length].text,
              )}
              style={{ background: QUICK_TONES[i % QUICK_TONES.length].chipGrad }}
            >
              <Icon name={qa.icon} size={19} />
            </span>
            <span className="text-[10.5px] sm:text-t12 font-medium leading-tight text-charcoal/85 [overflow-wrap:anywhere]">
              {t(qa.labelKey)}
            </span>
          </button>
        ))}
      </nav>

      {/* Hero: today's panchang + Acharya CTA — gold gradient glass elevation */}
      <GlassCard className="glass-elev glass-tint-gold p-5 sm:p-6">
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
                {panchang.choghadiya && (
                  <LiveNowStrip
                    choghadiya={panchang.choghadiya}
                    rahuKaal={panchang.rahuKaal}
                    tz={chart.input.timezone}
                    locale={locale}
                  />
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
          className="mt-4 w-full glass-ink sheen-sweep rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left transition-transform duration-250 ease-out hover:-translate-y-0.5 active:scale-[0.99] group"
        >
          {/* violet intuition aura — Acharya's domain colour */}
          <span className="pointer-events-none absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-violet/25 blur-2xl" aria-hidden="true" />
          <AcharyaAvatar size={44} className="shrink-0 relative" />
          <span className="flex-1 min-w-0">
            <span className="block text-t14 font-semibold text-gold-grad font-serif">{t('home.talkToAcharya')}</span>
            <span className="block text-t12 text-[#cdb98e] truncate">{t('home.acharyaByline')}</span>
          </span>
          <Icon name="chevron-right" size={18} className="text-gold transition-transform duration-250 group-hover:translate-x-0.5" />
        </button>
      </GlassCard>

      {/* Daily affirmation — grounded in the running maha-dasha lord */}
      {dashaNow?.mahaLord && (
        <div
          className="glass glass-tint-emerald relative overflow-hidden p-4 sm:p-5 stagger-in"
          style={{ animationDelay: '45ms', animationFillMode: 'backwards' }}
        >
          <div className="pointer-events-none absolute -top-9 -right-7 w-28 h-28 rounded-full bg-emerald/15 blur-2xl" aria-hidden="true" />
          <p className="text-t12 font-semibold uppercase tracking-wider text-emerald-deep flex items-center gap-1.5">
            <Icon name="sparkle" size={12} />
            {t('home.affirm.title')}
          </p>
          <p className="mt-1.5 font-serif text-t16 italic leading-relaxed text-charcoal">
            {t(`home.affirm.${dashaNow.mahaLord}`)}
          </p>
          {panchang && (
            <p className="mt-2 text-t12 text-muted-foreground">
              {t('home.affirm.season', { maha: t(`planet.${dashaNow.mahaLord}`), nakshatra: language === 'hi' ? panchang.nakshatra.nameHi : panchang.nakshatra.name })}
            </p>
          )}
        </div>
      )}

      {/* Sky ahead — upcoming purnima / ekadashi / sankranti / festivals */}
      {sky && sky.length > 0 && (
        <section aria-label={t('home.skyAhead')} className="stagger-in" style={{ animationDelay: '40ms', animationFillMode: 'backwards' }}>
          <SectionHeader title={t('home.skyAhead')} icon="moon" />
          <div className="relative" role="list">
            <span className="sky-fade sky-fade-l" aria-hidden="true" />
            <span className="sky-fade sky-fade-r" aria-hidden="true" />
            <div className="sky-strip no-scrollbar flex gap-2.5 overflow-x-auto pb-1 px-0.5">
              {sky.map((item, i) => {
                const whenLabel =
                  item.daysUntil === 0 ? t('home.today') : item.daysUntil === 1 ? t('home.tomorrow') : t('home.inDays', { n: item.daysUntil });
                return (
                  <button
                    key={`${item.kind}-${item.date}`}
                    type="button"
                    role="listitem"
                    onClick={() => {
                      useAppStore.getState().pushPendingFocus(`panchang:${item.date}`);
                      onNavigate('kundli', 'panchang');
                    }}
                    aria-label={`${language === 'hi' ? item.name.hi : item.name.en}, ${whenLabel}`}
                    className={cn(
                      'sky-chip group/chip shrink-0 min-w-[168px] max-w-[236px] text-left glass rounded-xl px-3 py-2.5',
                      'transition-all duration-250 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-8px_rgba(201,162,39,0.45)] active:scale-[0.97]',
                      'animate-in fade-in-0 slide-in-from-left-2 focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none',
                    )}
                    style={{ animationDelay: `${Math.min(i, 8) * 45}ms`, animationFillMode: 'backwards' }}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'shrink-0 w-7 h-7 rounded-full border flex items-center justify-center transition-transform duration-250 group-hover/chip:scale-110',
                          item.kind === 'festival'
                            ? 'bg-rose-soft border-rose/35'
                            : 'bg-gold-soft/70 border-gold/25',
                        )}
                      >
                        <Icon name={SKY_ICON[item.kind]} size={14} className={item.kind === 'festival' ? 'text-rose-deep' : 'text-gold'} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-t14 font-medium text-charcoal truncate">{language === 'hi' ? item.name.hi : item.name.en}</span>
                        <span className="block text-t12 text-muted-foreground truncate">
                          {new Date(`${item.date}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                          <span className="text-gold"> · {whenLabel}</span>
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Dasha transition countdown — ink card */}
      {dashaNow && dashaNow.next.lord && (
        <GlassCard className="p-5 sm:p-6 glass-ink relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-t12 uppercase tracking-wider text-gold font-semibold">{t('dasha.cardTitle')}</p>
              <p className="mt-2 text-t16 font-serif text-gold-grad font-semibold">
                {t('dasha.current', { maha: t(`planet.${dashaNow.mahaLord}`), antar: dashaNow.antarLord ? t(`planet.${dashaNow.antarLord}`) : '' })}
              </p>
              <p className="mt-1 text-t14 text-[#cdb98e]">
                {dashaNow.next.daysLeft <= 0
                  ? t('dasha.endsToday')
                  : dashaNow.next.isMahaChange
                    ? t('dasha.mahaChange', { next: t(`planet.${dashaNow.next.lord}`) })
                    : t('dasha.endsIn', { n: dashaNow.next.daysLeft, next: t(`planet.${dashaNow.next.lord}`) })}
                <span className="text-[#a5947a]"> · {new Date(`${dashaNow.next.dateISO}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('kundli', 'reports')}
              className="tap-sm -m-2 shrink-0 inline-flex h-9 items-center rounded-full px-2 text-t12 font-medium text-gold hover:text-gold-light underline underline-offset-4 decoration-gold/30 transition-colors duration-200"
            >
              {t('dasha.viewReports')}
            </button>
          </div>
          {/* Antardasha progress — thin gold bar on ink */}
          <div className="mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={dashaNow.antarPercent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full gold-grad rounded-full transition-all duration-500" style={{ width: `${dashaNow.antarPercent}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-t12 text-[#a5947a]">
            <span>{t(`planet.${dashaNow.mahaLord}`)}-{dashaNow.antarLord ? t(`planet.${dashaNow.antarLord}`) : ''}</span>
            <span>{dashaNow.antarPercent}%</span>
          </div>
        </GlassCard>
      )}

      {/* Daily check-in */}
      <GlassCard id="daily-checkin" className={cn('p-5 sm:p-6', flashCheckin && 'focus-flash')}>
        <AnimatePresence mode="wait">
          {checkin?.checkedInToday ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-4"
            >
              <span className="shrink-0 w-12 h-12 rounded-full emerald-grad flex items-center justify-center text-white shadow-[0_4px_14px_rgba(62,142,110,0.35)]">
                <Icon name="check" size={24} strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-t16 font-semibold text-charcoal">{t('home.checkinDone')}</p>
                <p className="text-t12 text-muted-foreground">{t('home.checkinDoneBody')}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1 text-emerald-deep font-semibold text-t16">
                  <Icon name="flame" size={18} className="flame-pulse" />
                  {checkin.streak}
                </span>
                <p className="text-t12 text-muted-foreground">{t('home.streak', { n: checkin.streak })}</p>
              </div>
            </motion.div>
          ) : !checkin && checkinError ? (
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
                  <Icon name="flame" size={14} className="text-emerald-deep" />
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
                  id="checkin-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('home.notePlaceholder')}
                  rows={2}
                  className="resize-none rounded-xl border-gold/25 bg-white/70 text-t14 focus-visible:ring-gold/30 max-h-24"
                  maxLength={280}
                />
                {/* Dasha-grounded note prompts — antardasha-aware, tap to insert */}
                {dashaNow?.mahaLord && !note && (() => {
                  const maha = dashaNow.mahaLord;
                  const antar = dashaNow.antarLord ?? null;
                  // With an antardasha: lead with its lord (most specific), then the
                  // maha lord, then one Navagraha neighbour that isn't already shown.
                  const lords = antar
                    ? [antar, maha, (PROMPT_LORDS[antar] ?? ['Su', 'Mo', 'Ju']).find((l) => l !== antar && l !== maha) ?? 'Mo']
                        .filter((v, i, a) => a.indexOf(v) === i).slice(0, 3)
                    : PROMPT_LORDS[maha] ?? ['Su', 'Mo', 'Ju'];
                  const promptOf = (lord: string) => (lord === antar ? t(`home.prompt2.${lord}`) : t(`home.prompt.${lord}`));
                  return (
                    <div className="rounded-xl bg-gold-faint/40 border border-gold/20 px-3 py-2.5">
                      <p className="text-t12 text-muted-foreground flex items-center gap-1.5">
                        <Icon name="sparkle" size={12} className="text-gold" />
                        {antar
                          ? t('home.promptLabelAntar', { maha: t(`planet.${maha}`), antar: t(`planet.${antar}`) })
                          : t('home.promptLabel', { maha: t(`planet.${maha}`) })}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {lords.map((lord) => (
                          <button
                            key={lord}
                            type="button"
                            onClick={() => {
                              setNote(promptOf(lord));
                              document.getElementById('checkin-note')?.focus();
                            }}
                            className="inline-flex items-center gap-1 rounded-full bg-white/70 border border-gold/30 px-2.5 py-1 text-t12 text-charcoal/80 hover:border-gold/60 hover:bg-gold-faint active:scale-95 transition-all duration-250"
                          >
                            <span className="text-gold font-semibold">{t(`planet.${lord}`)}</span>
                            <span className="max-w-52 truncate">{promptOf(lord)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {mood <= 2 && <p className="text-t12 text-maroon/80 italic">{t('home.checkinLow')}</p>}
                {checkinError && (
                  <p className="text-t12 font-medium text-maroon" role="alert">{t('common.networkError')} — {t('common.retry')}</p>
                )}
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
        <SectionHeader title={t('home.weeklyTitle')} icon="journal" tone="violet" />
        <GlassCard id="weekly-letter" ink className={cn('sheen-sweep p-5 sm:p-6', flashLetter && 'focus-flash')}>
          {/* violet intuition vignette — the letter is Acharya's reflective gift */}
          <div className="pointer-events-none absolute -top-14 -left-14 w-40 h-40 rounded-full bg-violet/30 blur-2xl" aria-hidden="true" />
          {checkin?.reflection ? (
            <>
              <button type="button" onClick={() => setLetterOpen((v) => !v)} className="w-full text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-t12 uppercase tracking-wider text-[#c9aee8] font-semibold flex items-center gap-1.5">
                      {t('home.weeklyReady')}
                      {letterAlert && (
                        <span className="inline-flex items-center gap-1 rounded-full violet-grad border border-violet-deep/40 px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-white animate-pulse">
                          <span className="w-1 h-1 rounded-full bg-white" />
                          {t('notifications.reflectionNewShort')}
                        </span>
                      )}
                    </p>
                    <p className="font-serif text-t20 mt-1 text-[#f0e4c3] truncate">
                      {checkin.reflection.reflectionText.split('\n')[0].slice(0, 80)}…
                    </p>
                    {weekRangeLabel && <p className="mt-1 text-t12 text-[#a5947a] italic">{weekRangeLabel}</p>}
                  </div>
                  <span className="shrink-0 flex flex-col items-center gap-1" aria-hidden>
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gold/40 bg-gold/10 rotate-45">
                      <span className="block w-3.5 h-3.5 rounded-[2px] bg-gradient-to-br from-[#E8C568] to-[#C9A227] shadow-[0_0_10px_rgba(232,197,104,0.45)]" />
                    </span>
                    <Icon name="chevron-down" size={16} className={cn('text-gold transition-transform duration-250', letterOpen && 'rotate-180')} />
                  </span>
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
                    <div className="ornament-divider mt-4" style={{ color: 'rgba(232,197,104,0.45)' }} aria-hidden>✦</div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={toggleLetterAudio}
                        className="inline-flex items-center gap-2 rounded-full bg-gold/15 border border-gold/40 px-4 py-1.5 text-t12 font-medium text-gold-light hover:bg-gold/25 active:scale-95 transition-all duration-250"
                      >
                        <Icon name={audioState === 'playing' ? 'pause' : 'speaker'} size={14} />
                        {audioState === 'loading' ? t('letter.loadingAudio') : audioState === 'playing' ? t('letter.stop') : t('letter.listen')}
                        {audioState === 'loading' && <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 rounded-full border border-gold/25 px-4 py-1.5 text-t12 font-medium text-[#cdb98e] hover:bg-gold/15 hover:text-gold-light active:scale-95 transition-all duration-250"
                      >
                        <Icon name="download" size={14} />
                        {t('letter.export')}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <span className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet/25 text-[#c9aee8]">
                <Icon name="journal" size={22} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-t14 text-[#e8dcbf]">{t('home.weeklyEmpty')}</p>
                {checkin && (
                  <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full violet-grad rounded-full transition-[width] duration-500"
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

      {/* Print-only letterhead view — revealed by the Export button (window.print) */}
      {checkin?.reflection && (
        <div id="letter-print" aria-hidden="true" hidden>
          <p className="lp-brand">Self Sage</p>
          <p className="lp-byline">{t('letter.printByline')}</p>
          {weekRangeLabel && <p className="lp-week">{weekRangeLabel}</p>}
          <div className="lp-rule" />
          <p className="lp-body">{checkin.reflection.reflectionText}</p>
          <p className="lp-sign">{t('letter.printSignature')}</p>
          <div className="lp-foot">
            <span>Self Sage · {t('home.weeklyTitle')}</span>
            <span>{dateLine}</span>
          </div>
        </div>
      )}

      {/* Feature grid */}
      {!chart && (
        <GlassCard className="p-5 flex items-center gap-4 border-burgundy/25">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-burgundy-soft text-burgundy shrink-0">
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
          <SectionHeader title={t(section.titleKey)} tone={section.tone} />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {section.items.map((item) => (
              <GlassCard
                key={item.titleKey}
                onClick={() => onNavigate('kundli', item.view)}
                className="glass-liquid p-4 sm:p-5 group ripple rounded-[22px]"
              >
                <span className={cn('inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-250', SECTION_CHIP_TONES[section.tone])}>
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

/**
 * Per-section icon chip tints — gold stays primary; predictions lean rose,
 * tools lean violet (secondary atmospheric colours only, never CTA).
 */
const SECTION_CHIP_TONES: Record<'gold' | 'rose' | 'violet', string> = {
  gold: 'bg-gold-soft/80 text-gold group-hover:gold-grad group-hover:text-charcoal',
  rose: 'bg-rose-soft text-rose-deep group-hover:rose-grad group-hover:text-white',
  violet: 'bg-violet-soft text-violet-deep group-hover:violet-grad group-hover:text-white',
};

/**
 * Journal note prompts per maha-dasha lord (localized via `home.prompt.<lord>`).
 * Three prompts are offered at a time — the current lord first, then two
 * neighbours in the classic Navagraha order — so the suggestion row stays small.
 */
const PROMPT_LORDS: Record<string, string[]> = {
  Su: ['Su', 'Mo', 'Ma'],
  Mo: ['Mo', 'Ma', 'Me'],
  Ma: ['Ma', 'Me', 'Ju'],
  Me: ['Me', 'Ju', 'Ve'],
  Ju: ['Ju', 'Ve', 'Sa'],
  Ve: ['Ve', 'Sa', 'Ra'],
  Sa: ['Sa', 'Ra', 'Ke'],
  Ra: ['Ra', 'Ke', 'Su'],
  Ke: ['Ke', 'Su', 'Mo'],
};

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
