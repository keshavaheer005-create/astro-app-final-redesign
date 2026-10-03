'use client';

import { shareText } from '@/lib/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons';
import { GlassCard, GoldButton, GhostButton, SectionHeader, PageLoader, ErrorState, ProgressBar } from '../ui-primitives';
import { api, useSession } from '../session-context';
import { useAuthPrompt } from '../auth-prompt';
import { cn } from '@/lib/utils';

interface PersonInput {
  name: string;
  dob: string;
  tob: string;
  lat: number;
  lng: number;
  timezone: string;
  placeName?: string;
}

type MangalLevel = 'none' | 'low' | 'high';
interface MangalInfo {
  severity: string;
  /** AstroSage grading (older saved results don't have it — derived from severity). */
  level?: MangalLevel;
  fromAsc: boolean;
  fromMoon: boolean;
  fromVenus?: boolean;
  marsHouseFromAsc: number;
  marsHouseFromMoon?: number;
  marsHouseFromVenus?: number;
}
const levelOf = (d: MangalInfo): MangalLevel => d.level ?? (d.severity === 'none' ? 'none' : d.severity === 'strong' ? 'high' : 'low');
const LEVEL_TEXT: Record<MangalLevel, string> = { none: 'No Mangal Dosha', low: 'Low Mangal Dosha', high: 'High Mangal Dosha' };

interface MatchResponse {
  match: {
    total: number;
    max: number;
    verdict: 'excellent' | 'good' | 'average' | 'challenging';
    verdictNote: string;
    kootas: { key: string; score: number; max: number; note: string }[];
    nadiDosha: boolean;
    bhakootDosha: boolean;
    ganaDosha: boolean;
  };
  boySummary: { name: string; ascendant: string; moonSign: string; moonNakshatra: string };
  girlSummary: { name: string; ascendant: string; moonSign: string; moonNakshatra: string };
  boyMangalDosha: MangalInfo;
  girlMangalDosha: MangalInfo;
  /** Optional: older saved results don't have it. */
  extras?: {
    dosha: { items: { key: string; present: boolean; cancelled: boolean; pointsLost: number; reasons: string[] }[]; adjustedTotal: number | null };
    manglik: { boyLevel: 'none' | 'low' | 'high'; girlLevel: 'none' | 'low' | 'high'; compatible: boolean; note: string };
    conclusion: { lowPoints: boolean; manglikMismatch: boolean; preferable: boolean; text: string };
    dashakoota: {
      items: { key: string; pass: boolean; veto: boolean; note: string }[];
      passed: number;
      max: number;
      verdict: 'recommended' | 'acceptable' | 'not_recommended' | 'rejected';
      note: string;
    };
  };
}

const BLANK: PersonInput = { name: '', dob: '', tob: '', lat: 0, lng: 0, timezone: 'Asia/Kolkata', placeName: '' };

interface MatchHistoryItem {
  id: string;
  at: number;
  boyName: string;
  girlName: string;
  total: number;
  verdict: string;
  boy: PersonInput;
  girl: PersonInput;
  result: MatchResponse;
}
const HISTORY_KEY = 'ss-match-history-v1';

export function MatchingScreen() {
  const { t } = useTranslation();
  const { chart } = useSession();
  const { requireAuth } = useAuthPrompt();
  const [boy, setBoy] = useState<PersonInput>(BLANK);
  const [girl, setGirl] = useState<PersonInput>(BLANK);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as MatchHistoryItem[]);
    } catch {
      /* ignore corrupt history */
    }
  }, []);

  const saveToHistory = useCallback((b: PersonInput, g: PersonInput, res: MatchResponse) => {
    const item: MatchHistoryItem = {
      id: `m-${Date.now()}`,
      at: Date.now(),
      boyName: b.name?.trim() || '—',
      girlName: g.name?.trim() || '—',
      total: res.match.total,
      verdict: res.match.verdict,
      boy: b,
      girl: g,
      result: res,
    };
    setHistory((h) => {
      const next = [item, ...h].slice(0, 6);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* storage full — skip */
      }
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* */
    }
  }, []);

  // Share the current result via Web Share API (clipboard fallback)
  const [shareState, setShareState] = useState<'idle' | 'done'>('idle');
  const shareResult = useCallback(async () => {
    if (!result) return;
    const lines = [
      t('match.shareTitle', { boy: result.boySummary.name, girl: result.girlSummary.name }),
      `${result.boySummary.name} × ${result.girlSummary.name} — ${result.match.total}/36 · ${t('match.verdict.' + result.match.verdict)}`,
      '',
      ...result.match.kootas.map((k) => `• ${k.key}: ${k.score}/${k.max}`),
      '',
      t('match.shareFooter'),
    ];
    const text = lines.join('\n');
    try {
      const mode = await shareText(t('match.title'), text);
      setShareState('done');
      if (mode === 'copied') setTimeout(() => setShareState('idle'), 2400);
    } catch {
      /* user cancelled — ignore */
    }
  }, [result, t]);

  useEffect(() => {
    if (chart) {
      setBoy({
        name: chart.input.name,
        dob: chart.input.dob,
        tob: chart.input.tob,
        lat: chart.input.lat,
        lng: chart.input.lng,
        timezone: chart.input.timezone,
        placeName: chart.input.placeName,
      });
    }
  }, [chart]);

  const runMatch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api<MatchResponse>('/api/match', {
        method: 'POST',
        body: JSON.stringify({ boy, girl }),
      });
      setResult(res);
      saveToHistory(boy, girl, res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [boy, girl, saveToHistory]);

  const compute = useCallback(() => {
    if (!boy.dob || !boy.tob || !girl.dob || !girl.tob) {
      setError('Fill both birth details');
      return;
    }
    // Matching is for signed-in members; the details stay filled in and the
    // match runs as soon as the guest signs in.
    if (!requireAuth('matching', () => void runMatch())) return;
    void runMatch();
  }, [boy, girl, requireAuth, runMatch]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-t28 font-bold text-rose-grad">{t('match.title')}</h1>
        <p className="text-t14 text-muted-foreground">{t('match.subtitle')}</p>
      </header>
      {/* rose = the matching/harmony domain colour: a soft tinted hairline under the title */}
      <div className="-mt-3 h-px bg-gradient-to-r from-rose/40 via-rose/15 to-transparent" aria-hidden="true" />

      <div className="grid md:grid-cols-2 gap-4">
        <PersonForm
          label={t('match.boy')}
          value={boy}
          onChange={setBoy}
          extra={
            chart && (
              <GhostButton
                className="h-8 px-3 text-t12"
                onClick={() =>
                  setBoy({
                    name: chart.input.name,
                    dob: chart.input.dob,
                    tob: chart.input.tob,
                    lat: chart.input.lat,
                    lng: chart.input.lng,
                    timezone: chart.input.timezone,
                    placeName: chart.input.placeName,
                  })
                }
              >
                <Icon name="user" size={14} /> {t('match.useMine')}
              </GhostButton>
            )
          }
        />
        <PersonForm label={t('match.girl')} value={girl} onChange={setGirl} />
      </div>

      {error && <p className="text-t14 text-burgundy">{error}</p>}
      <GoldButton onClick={compute} disabled={loading} className="w-full">
        {loading ? t('common.calculating') : t('match.compute')} <Icon name="handshake" size={16} />
      </GoldButton>

      {history.length > 0 && (
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-t12 uppercase tracking-wider text-rose-deep font-semibold">{t('match.history')}</p>
            <button
              type="button"
              onClick={clearHistory}
              className="tap-sm text-t12 text-muted-foreground hover:text-burgundy transition-colors duration-200"
            >
              {t('match.clearHistory')}
            </button>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto scroll-slim pr-1">
            {history.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  setBoy(h.boy);
                  setGirl(h.girl);
                  setResult(h.result);
                }}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-gold/15 bg-white/50 px-3.5 py-2.5 text-left transition-all duration-200 hover:border-gold/45 hover:bg-white/70 active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="block text-t14 text-charcoal truncate">
                    {h.boyName} × {h.girlName}
                  </span>
                  <span className="block text-t12 text-muted-foreground">{new Date(h.at).toLocaleDateString()}</span>
                </span>
                <span className="shrink-0 inline-flex items-center rounded-full rose-grad px-2.5 py-1 text-t12 font-bold text-white shadow-[0_2px_8px_rgba(194,69,90,0.3)]">
                  {h.total}/36
                </span>
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {loading && <PageLoader label={t('common.calculating')} />}

      {result && (
        <>
          <GlassCard className="p-5 sm:p-6 relative" ink>
            {/* rose harmony aura — this card celebrates the union */}
            <div className="pointer-events-none absolute -top-14 -right-14 w-44 h-44 rounded-full bg-rose/25 blur-2xl" aria-hidden="true" />
            <div className="flex flex-col sm:flex-row items-center gap-5 relative">
              <div className="relative shrink-0">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(217,112,138,0.22)" strokeWidth="8" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="#D9708A"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(result.match.total / 36) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dasharray 700ms ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-serif text-t28 font-bold text-rose-grad">{result.match.total}</span>
                  <span className="text-t12 text-[#a5947a]">/ 36</span>
                </div>
              </div>
              <div className="text-center sm:text-left">
                <h2 className="font-serif text-t20 font-bold text-[#f0e4c3]">{t('match.verdict.' + result.match.verdict)}</h2>
                <p className="text-t12 text-[#cdb98e] mt-1 leading-relaxed max-w-md">{t('match.verdictNote')}</p>
                <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-1.5">
                  {result.match.nadiDosha && <DoshaTag label="Nadi Dosha" />}
                  {result.match.bhakootDosha && <DoshaTag label="Bhakoot Dosha" />}
                  {result.match.ganaDosha && <DoshaTag label="Gana Dosha" />}
                </div>
                <button
                  type="button"
                  onClick={() => void shareResult()}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold/15 border border-gold/40 px-3.5 py-1.5 text-t12 font-medium text-gold-light hover:bg-gold/25 active:scale-95 transition-all duration-250"
                >
                  <Icon name="share" size={13} />
                  {shareState === 'done' ? t('match.shareCopied') : t('match.share')}
                </button>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 sm:p-5">
            <SectionHeader title={t('match.subtitle')} icon="scale" tone="rose" />
            <div className="space-y-3.5">
              {result.match.kootas.map((k) => (
                <div key={k.key}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-t14 font-medium text-charcoal">{k.key}</span>
                    <span className={cn('text-t14 font-bold', k.score >= k.max * 0.6 ? 'text-rose-deep' : k.score === 0 ? 'text-burgundy' : 'text-muted-foreground')}>
                      {k.score} / {k.max}
                    </span>
                  </div>
                  <ProgressBar value={(k.score / k.max) * 100} tone={k.score >= k.max * 0.6 ? 'rose' : 'gold'} />
                  <p className="text-t12 text-muted-foreground mt-0.5">{k.note}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="grid sm:grid-cols-2 gap-4">
            <SummaryCard
              title={t('match.summaryTitle', { defaultValue: '' }) || result.boySummary.name}
              summary={result.boySummary}
              dosha={result.boyMangalDosha}
              titleKey="match.mangalBoy"
              name={result.boySummary.name}
            />
            <SummaryCard
              title={result.girlSummary.name}
              summary={result.girlSummary}
              dosha={result.girlMangalDosha}
              titleKey="match.mangalGirl"
              name={result.girlSummary.name}
            />
          </div>

          {result.extras && <MatchExtras extras={result.extras} total={result.match.total} boyName={result.boySummary.name} girlName={result.girlSummary.name} />}
        </>
      )}
    </div>
  );
}

function MatchExtras({ extras, total, boyName, girlName }: { extras: NonNullable<MatchResponse['extras']>; total: number; boyName: string; girlName: string }) {
  const { t } = useTranslation();
  const { manglik, dosha, dashakoota } = extras;
  const activeDoshas = dosha.items.filter((d) => d.present);
  const verdictTone = dashakoota.verdict === 'recommended' || dashakoota.verdict === 'acceptable';
  const boyLv = LEVEL_TEXT[manglik.boyLevel];
  const girlLv = LEVEL_TEXT[manglik.girlLevel];
  return (
    <>
      {/* AstroSage-style headline */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('match.resultsTitle', { defaultValue: 'Horoscope Matching Results' })} icon="scale" tone="rose" />
        <ul className="space-y-2 text-t14 text-charcoal list-disc pl-5">
          <li>
            {t('match.resultsScore', { defaultValue: 'Ashtakoot matching between boy and girl is' })} <b>{total}/36</b>
          </li>
          <li>
            {boyName} — <b>&lsquo;{boyLv}&rsquo;</b>; {girlName} — <b>&lsquo;{girlLv}&rsquo;</b>
          </li>
          <li className={extras.conclusion.preferable ? 'text-emerald-deep' : 'text-burgundy'}>
            <b>{t('match.conclusion', { defaultValue: 'Conclusion' })}:</b> {extras.conclusion.text}
          </li>
        </ul>
      </GlassCard>

      {/* Manglik compatibility */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('match.manglikTitle', { defaultValue: 'Manglik compatibility' })} icon="warning" tone="rose" />
        <div className={cn('rounded-xl px-3.5 py-3 border', manglik.compatible ? 'bg-emerald-soft/70 border-emerald/25' : 'bg-burgundy-soft border-burgundy/25')}>
          <p className={cn('text-t14 font-semibold', manglik.compatible ? 'text-emerald-deep' : 'text-burgundy')}>
            {manglik.compatible ? t('match.manglikOk', { defaultValue: 'Mangal Dosha levels agree' }) : t('match.manglikWarn', { defaultValue: 'Mangal Dosha levels differ' })}
          </p>
          <p className="text-t12 text-muted-foreground mt-1 leading-relaxed">{manglik.note}</p>
        </div>
      </GlassCard>

      {/* Dosha check and cancellations */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('match.doshaTitle', { defaultValue: 'Dosha check & cancellations' })} icon="scale" tone="rose" />
        {activeDoshas.length === 0 ? (
          <p className="text-t14 text-emerald-deep font-semibold">{t('match.noDosha', { defaultValue: 'No Nadi, Bhakoot or Gana dosha found.' })}</p>
        ) : (
          <div className="space-y-2.5">
            {activeDoshas.map((d) => (
              <div key={d.key} className={cn('rounded-xl px-3.5 py-2.5 border', d.cancelled ? 'bg-emerald-soft/70 border-emerald/25' : 'bg-burgundy-soft border-burgundy/25')}>
                <p className={cn('text-t14 font-semibold', d.cancelled ? 'text-emerald-deep' : 'text-burgundy')}>
                  {d.key} {t('match.dosha.word', { defaultValue: 'dosha' })} —{' '}
                  {d.cancelled ? t('match.doshaCancelled', { defaultValue: 'cancelled' }) : t('match.doshaActive', { defaultValue: 'active' })}
                </p>
                {d.reasons.map((r) => (
                  <p key={r} className="text-t12 text-muted-foreground mt-0.5 leading-relaxed">• {r}</p>
                ))}
              </div>
            ))}
            {dosha.adjustedTotal != null && (
              <p className="text-t12 text-muted-foreground leading-relaxed">
                {t('match.adjusted', { defaultValue: 'If the cancelled doshas are counted, the score would be' })} <b>{dosha.adjustedTotal}/36</b>{' '}
                ({t('match.adjustedNote', { defaultValue: 'the official Ashtakoot score stays' })} {total}/36).
              </p>
            )}
          </div>
        )}
      </GlassCard>

      {/* Dashakoota */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('match.dashaTitle', { defaultValue: 'South Indian Dashakoota (10 Porutham)' })} icon="scale" tone="rose" />
        <div className={cn('rounded-xl px-3.5 py-3 border mb-3', verdictTone ? 'bg-emerald-soft/70 border-emerald/25' : 'bg-burgundy-soft border-burgundy/25')}>
          <p className={cn('text-t14 font-semibold', verdictTone ? 'text-emerald-deep' : 'text-burgundy')}>
            {dashakoota.passed}/{dashakoota.max} · {t(`match.dasha.${dashakoota.verdict}`, { defaultValue: dashakoota.verdict.replace('_', ' ') })}
          </p>
          <p className="text-t12 text-muted-foreground mt-1 leading-relaxed">{dashakoota.note}</p>
        </div>
        <div className="space-y-2">
          {dashakoota.items.map((i) => (
            <div key={i.key} className="flex items-start gap-2.5">
              <span className={cn('mt-0.5 text-t14 font-bold w-4 shrink-0', i.pass ? 'text-emerald-deep' : 'text-burgundy')} aria-label={i.pass ? 'pass' : 'fail'}>
                {i.pass ? '✔' : '✘'}
              </span>
              <div className="min-w-0">
                <p className="text-t14 font-medium text-charcoal">
                  {i.key}
                  {i.veto && <span className="ml-1.5 rounded-full bg-gold/15 border border-gold/40 px-1.5 py-px text-t12 text-gold align-middle">{t('match.veto', { defaultValue: 'key check' })}</span>}
                </p>
                <p className="text-t12 text-muted-foreground leading-relaxed">{i.note}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-t12 text-muted-foreground mt-3 leading-relaxed">
          {t('match.dashaFoot', { defaultValue: 'Counts run from the bride\'s star to the groom\'s. Schools differ on some poruthams; Rajju and Vedha are treated as vetoes.' })}
        </p>
      </GlassCard>
    </>
  );
}

function DoshaTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-burgundy/30 border border-burgundy/55 px-2.5 py-0.5 text-t12 text-[#ecd0d6]">
      <Icon name="warning" size={11} /> {label}
    </span>
  );
}

function SummaryCard({
  title,
  summary,
  dosha,
  titleKey,
  name,
}: {
  title: string;
  summary: { ascendant: string; moonSign: string; moonNakshatra: string };
  dosha: MangalInfo;
  titleKey: string;
  name: string;
}) {
  const { t } = useTranslation();
  const level = levelOf(dosha);
  return (
    <GlassCard className="p-4 sm:p-5">
      <p className="text-t12 uppercase tracking-wider text-rose-deep font-semibold">{title}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-rose-faint/80 border border-rose/15 px-2 py-1.5">
          <p className="text-t12 text-muted-foreground">{t('match.summaryAsc')}</p>
          <p className="text-t14 font-semibold text-charcoal">{summary.ascendant}</p>
        </div>
        <div className="rounded-lg bg-rose-faint/80 border border-rose/15 px-2 py-1.5">
          <p className="text-t12 text-muted-foreground">{t('match.summaryMoon')}</p>
          <p className="text-t14 font-semibold text-charcoal">{summary.moonSign}</p>
        </div>
        <div className="rounded-lg bg-rose-faint/80 border border-rose/15 px-2 py-1.5">
          <p className="text-t12 text-muted-foreground">{t('match.summaryNak')}</p>
          <p className="text-t14 font-semibold text-charcoal truncate">{summary.moonNakshatra}</p>
        </div>
      </div>
      <div className={cn('mt-3 rounded-xl px-3.5 py-3 border', level === 'none' ? 'bg-emerald-soft/70 border-emerald/25' : 'bg-burgundy-soft border-burgundy/25')}>
        <p className="text-t12 uppercase tracking-wide font-semibold text-muted-foreground">{t(titleKey, { name })}</p>
        <p className={cn('text-t14 font-semibold mt-1', level === 'none' ? 'text-emerald-deep' : 'text-burgundy')}>
          {t(`match.level.${level}`, { defaultValue: LEVEL_TEXT[level] })}
        </p>
        <div className="mt-1.5 space-y-0.5">
          {([
            ['Lagna', dosha.marsHouseFromAsc, dosha.fromAsc],
            ['Moon', dosha.marsHouseFromMoon, dosha.fromMoon],
            ['Venus', dosha.marsHouseFromVenus, dosha.fromVenus],
          ] as [string, number | undefined, boolean | undefined][])
            .filter(([, house]) => house != null)
            .map(([chart, house, hit]) => (
              <p key={chart} className="text-t12 text-muted-foreground">
                <span className={cn('font-bold mr-1', hit ? 'text-burgundy' : 'text-emerald-deep')}>{hit ? '●' : '○'}</span>
                {t('match.marsFrom', { defaultValue: 'Mars in house {{house}} from {{chart}}', house, chart })}
                {hit ? '' : ` — ${t('match.notDoshaHouse', { defaultValue: 'not a dosha house' })}`}
              </p>
            ))}
        </div>
      </div>
    </GlassCard>
  );
}

function PersonForm({
  label,
  value,
  onChange,
  extra,
}: {
  label: string;
  value: PersonInput;
  onChange: (v: PersonInput) => void;
  extra?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(value.placeName ?? '');
  const [results, setResults] = useState<{ name: string; lat: number; lng: number; timezone: string; country?: string }[]>([]);
  const [open, setOpen] = useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // keep visible place query in sync when the parent swaps in a full chart
  // (adjust-during-render pattern, endorsed for derived state resets)
  const [prevPlace, setPrevPlace] = useState(value.placeName ?? '');
  if (prevPlace !== value.placeName) {
    setPrevPlace(value.placeName ?? '');
    setQuery(value.placeName ?? '');
  }

  const search = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) return;
    timer.current = setTimeout(async () => {
      try {
        const res = await api<{ results: typeof results }>('/api/geocode', {
          method: 'POST',
          body: JSON.stringify({ placeName: q }),
        });
        setResults(res.results);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 350);
  };

  const set = (patch: Partial<PersonInput>) => onChange({ ...value, ...patch });

  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-t12 uppercase tracking-wider text-rose-deep font-semibold">{label}</p>
        {extra}
      </div>
      <input
        value={value.name}
        onChange={(e) => set({ name: e.target.value })}
        placeholder={t('common.name')}
        className="mt-3 w-full h-10 rounded-xl border border-gold/30 bg-white/70 px-3.5 text-t14 outline-none transition-all duration-250 focus:border-gold/60"
      />
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <input
          type="date"
          value={value.dob}
          onChange={(e) => set({ dob: e.target.value })}
          className="h-10 rounded-xl border border-gold/30 bg-white/70 px-3 text-t14 text-charcoal outline-none transition-all duration-250 focus:border-gold/60"
        />
        <input
          type="time"
          value={value.tob}
          onChange={(e) => set({ tob: e.target.value })}
          className="h-10 rounded-xl border border-gold/30 bg-white/70 px-3 text-t14 text-charcoal outline-none transition-all duration-250 focus:border-gold/60"
        />
      </div>
      <div className="mt-2.5 relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => setOpen(results.length > 0)}
          placeholder={t('common.place')}
          className="w-full h-10 rounded-xl border border-gold/30 bg-white/70 px-3.5 text-t14 outline-none transition-all duration-250 focus:border-gold/60"
        />
        {open && results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-gold/25 bg-white/95 backdrop-blur shadow-lg overflow-hidden max-h-40 overflow-y-auto scroll-slim">
            {results.map((r, i) => (
              <button
                key={`${r.name}-${i}`}
                type="button"
                onClick={() => {
                  set({ lat: r.lat, lng: r.lng, timezone: r.timezone, placeName: r.name });
                  setQuery(r.name);
                  setOpen(false);
                }}
                className="tap-sm w-full text-left px-3.5 py-2 hover:bg-rose-soft/70 transition-colors text-t14"
              >
                {r.name} {r.country ? <span className="text-muted-foreground text-t12">· {r.country}</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
