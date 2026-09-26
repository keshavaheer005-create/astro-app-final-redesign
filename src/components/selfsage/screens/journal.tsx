'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../icons';
import { GlassCard, SectionHeader, GoldButton, EmptyState, PageLoader, ErrorState } from '../ui-primitives';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { api, useSession } from '../session-context';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';

interface Entry {
  id: string;
  date: string;
  moodScore: number;
  energyScore: number | null;
  note: string | null;
  dashaPeriodSnapshot: { mahaLord?: string; antarLord?: string } | null;
}

interface CheckinData {
  streak: number;
  checkedInToday: boolean;
  total: number;
  entries: Entry[];
  reflection: { weekStartDate: string; reflectionText: string } | null;
}

interface Insights {
  ready: boolean;
  days: number;
  avgMood: number | null;
  avgEnergy: number | null;
  bestPeriod: { label: string; avgMood: number; days: number } | null;
  worstPeriod: { label: string; avgMood: number; days: number } | null;
  periods: { label: string; avgMood: number; days: number }[];
  correlation: number | null;
  weekendEffect: number | null;
  notableNotes: { date: string; note: string | null }[];
}

interface DecisionResult {
  verdict: 'favorable' | 'mixed' | 'wait';
  score: number;
  factors: string[];
  windows: string[];
  narrative: string;
}

export function JournalScreen({ initialDecisionOpen, onNavigate }: { initialDecisionOpen?: boolean; onNavigate?: (tab: 'home' | 'kundli' | 'journal' | 'acharya' | 'profile', view?: string) => void }) {
  const { t } = useTranslation();
  const { chart } = useSession();
  const [data, setData] = useState<CheckinData | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsNarrative, setInsightsNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(!!initialDecisionOpen);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [c, i] = await Promise.all([
        api<CheckinData>('/api/checkins'),
        api<Insights>('/api/checkins', { method: 'PATCH' }),
      ]);
      setData(c);
      setInsights(i);
      if (i.ready && i.days >= 14) {
        try {
          const res = await api<{ narrative: string }>('/api/pattern-narrative', {
            method: 'POST',
            body: JSON.stringify({ aggregates: i }),
          }).catch(() => null);
          if (res?.narrative) setInsightsNarrative(res.narrative);
        } catch { /* narrative is optional */ }
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-t28 font-bold text-charcoal">{t('journal.title')}</h1>
          <p className="text-t14 text-muted-foreground">{t('journal.subtitle')}</p>
        </div>
        {data && data.streak > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-maroon-soft text-maroon px-3.5 py-1.5 text-t14 font-semibold">
            <Icon name="flame" size={16} /> {t('journal.streak', { n: data.streak })}
          </span>
        )}
      </header>

      {loading && <PageLoader label={t('common.loading')} />}
      {error && <ErrorState onRetry={load} message={t('common.networkError')} />}

      {data && data.total === 0 && (
        <GlassCard className="p-6">
          <EmptyState icon="journal" title={t('journal.empty')} body={t('journal.emptyBody')} />
          <div className="flex justify-center -mt-2">
            <GoldButton onClick={() => onNavigate?.('home')}>
              <Icon name="home" size={16} /> {t('journal.checkinCta')}
            </GoldButton>
          </div>
        </GlassCard>
      )}

      {data && data.total > 0 && (
        <>
          {/* Mood timeline with dasha bands */}
          <GlassCard className="p-4 sm:p-5">
            <SectionHeader title={t('journal.timeline')} icon="trending" />
            <p className="text-t12 text-muted-foreground mb-3">{t('journal.timelineHint')}</p>
            <MoodTimeline entries={[...data.entries].reverse().slice(-60)} />
            <p className="mt-2 text-t12 text-muted-foreground">{t('journal.moodScale')}</p>
          </GlassCard>

          {/* Correlation insight */}
          <GlassCard className="p-4 sm:p-5">
            <SectionHeader title={t('journal.insights')} icon="sparkle" />
            {!insights?.ready ? (
              <div>
                <p className="text-t14 text-muted-foreground">{t('journal.insightsNeedMore', { n: insights?.days ?? data.total })}</p>
                <div className="mt-3 h-2 rounded-full bg-gold/15 overflow-hidden">
                  <div
                    className="h-full gold-grad rounded-full transition-[width] duration-700"
                    style={{ width: `${Math.min(100, ((insights?.days ?? data.total) / 14) * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-t12 text-muted-foreground">{t('journal.insightsProgress', { n: insights?.days ?? data.total })}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {insightsNarrative && (
                  <p className="text-t14 text-charcoal leading-relaxed border-l-2 border-gold/50 pl-3 italic">{insightsNarrative}</p>
                )}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <InsightTile label={t('journal.avgMood')} value={insights.avgMood != null ? `${insights.avgMood}/5` : '—'} icon="heart" />
                  <InsightTile label={t('journal.avgEnergy')} value={insights.avgEnergy != null ? `${insights.avgEnergy}/5` : '—'} icon="sun" />
                  <InsightTile
                    label={t('journal.bestPeriod')}
                    value={insights.bestPeriod ? t(`planet.${insights.bestPeriod.label}`) : '—'}
                    sub={insights.bestPeriod ? `${insights.bestPeriod.avgMood}/5 · ${insights.bestPeriod.days}d` : undefined}
                    icon="trending"
                  />
                  <InsightTile
                    label={t('journal.worstPeriod')}
                    value={insights.worstPeriod ? t(`planet.${insights.worstPeriod.label}`) : '—'}
                    sub={insights.worstPeriod ? `${insights.worstPeriod.avgMood}/5 · ${insights.worstPeriod.days}d` : undefined}
                    icon="moon"
                  />
                </div>
                {insights.correlation != null && (
                  <p className="text-t14 text-charcoal">
                    {Math.abs(insights.correlation) >= 0.6
                      ? t('journal.correlationHigh', { r: insights.correlation })
                      : Math.abs(insights.correlation) >= 0.3
                        ? t('journal.correlationMid', { r: insights.correlation })
                        : t('journal.correlationLow', { r: insights.correlation })}
                  </p>
                )}
                {insights.periods.length >= 2 && (
                  <div>
                    <p className="text-t12 uppercase tracking-wide font-semibold text-gold mb-2">{t('journal.periods')}</p>
                    <div className="space-y-1.5">
                      {insights.periods.map((p) => (
                        <div key={p.label} className="flex items-center gap-2.5">
                          <span className="w-24 text-t12 text-muted-foreground truncate">{t(`planet.${p.label}`)}</span>
                          <div className="flex-1 h-2 rounded-full bg-gold/15 overflow-hidden">
                            <div className="h-full gold-grad rounded-full" style={{ width: `${(p.avgMood / 5) * 100}%` }} />
                          </div>
                          <span className="w-16 text-right text-t12 text-muted-foreground">{p.avgMood}/5 · {p.days}d</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </GlassCard>

          {/* Decision timing entry */}
          <GlassCard onClick={() => setDecisionOpen(true)} className="p-4 sm:p-5 flex items-center gap-4 group">
            <span className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold-soft text-gold transition-all duration-250 group-hover:gold-grad group-hover:text-charcoal">
              <Icon name="compass" size={22} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-t14 font-semibold text-charcoal">{t('decision.title')}</p>
              <p className="text-t12 text-muted-foreground">{t('decision.subtitle')}</p>
            </div>
            <Icon name="chevron-right" size={18} className="text-gold transition-transform duration-250 group-hover:translate-x-0.5" />
          </GlassCard>

          {/* History */}
          <GlassCard className="p-4 sm:p-5">
            <SectionHeader title={t('journal.history')} icon="list" />
            <div className="space-y-2.5 max-h-96 overflow-y-auto scroll-slim pr-1">
              {data.entries.map((e) => (
                <div key={e.id} className="flex items-start gap-3 rounded-xl bg-white/50 border border-gold/15 px-3.5 py-3">
                  <MoodDot value={e.moodScore} />
                  <div className="flex-1 min-w-0">
                    <p className="text-t12 text-muted-foreground">
                      {e.date}
                      {e.dashaPeriodSnapshot?.mahaLord ? ` · ${t('journal.during', { maha: t(`planet.${e.dashaPeriodSnapshot.mahaLord}`) })}` : ''}
                      {e.energyScore != null ? ` · ${t('home.energy')} ${e.energyScore}/5` : ''}
                    </p>
                    {e.note && <p className="text-t14 text-charcoal mt-0.5 break-words">{e.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </>
      )}

      <DecisionDialog open={decisionOpen} onOpenChange={setDecisionOpen} hasChart={!!chart} />
    </div>
  );
}

const MOOD_COLORS = ['#6B2737', '#a4552f', '#b08a1e', '#7a8b6f', '#5c7a4f'];

function MoodDot({ value }: { value: number }) {
  return (
    <span
      className="shrink-0 w-8 h-8 rounded-full inline-flex items-center justify-center text-t12 font-bold text-white"
      style={{ background: MOOD_COLORS[Math.max(0, Math.min(4, value - 1))] }}
    >
      {value}
    </span>
  );
}

function InsightTile({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: 'heart' | 'sun' | 'trending' | 'moon' }) {
  return (
    <div className="rounded-xl bg-gold-faint/70 border border-gold/20 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-gold">
        <Icon name={icon} size={14} />
        <span className="text-t12 text-muted-foreground truncate">{label}</span>
      </div>
      <p className="mt-1 text-t16 font-bold text-charcoal">{value}</p>
      {sub && <p className="text-t12 text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MoodTimeline({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) return null;
  const W = 100;
  const H = 42;
  const n = entries.length;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (m: number) => H - ((m - 1) / 4) * (H - 8) - 4;

  const path = entries.map((e, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(e.moodScore).toFixed(2)}`).join(' ');

  // dasha bands: group consecutive entries by mahaLord
  const bands: { start: number; end: number; lord: string }[] = [];
  entries.forEach((e, i) => {
    const lord = e.dashaPeriodSnapshot?.mahaLord ?? '?';
    const last = bands[bands.length - 1];
    if (last && last.lord === lord) last.end = i;
    else bands.push({ start: i, end: i, lord });
  });
  const bandColors = ['#c9a227', '#6b2737', '#7a8b6f', '#b08a1e', '#5c4a7a', '#a4552f'];
  void bandColors;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none" role="img" aria-label="Mood timeline">
        <line x1="0" y1={y(3)} x2={W} y2={y(3)} stroke="rgba(201,162,39,0.2)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
        <path d={path} fill="none" stroke="#c9a227" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {entries.map((e, i) => (
          <circle key={e.id} cx={x(i)} cy={y(e.moodScore)} r="1.1" fill={MOOD_COLORS[e.moodScore - 1]} stroke="#faf7f0" strokeWidth="0.35" />
        ))}
      </svg>
      {/* dasha bands under the line */}
      <div className="flex h-6 rounded-lg overflow-hidden mt-2 border border-gold/20">
        {bands.map((b, i) => (
          <div
            key={i}
            className="flex items-center justify-center overflow-hidden"
            style={{
              width: `${((b.end - b.start + 1) / n) * 100}%`,
              background: i % 2 === 0 ? 'rgba(201,162,39,0.16)' : 'rgba(107,39,55,0.14)',
            }}
            title={b.lord}
          >
            {(b.end - b.start) >= 3 && <span className="text-t12 font-semibold text-charcoal/70 truncate px-1">{b.lord}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionDialog({ open, onOpenChange, hasChart }: { open: boolean; onOpenChange: (v: boolean) => void; hasChart: boolean }) {
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const compute = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api<DecisionResult>('/api/decision-timing', {
        method: 'POST',
        body: JSON.stringify({ decisionText: text.trim(), language }),
      });
      setResult(res);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === 'no_chart' ? t('decision.needChart') : t('common.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-lg max-h-[85vh] overflow-y-auto scroll-slim border-gold/30">
        <DialogHeader>
          <DialogTitle className="font-serif text-t20 text-charcoal flex items-center gap-2">
            <span className="text-gold"><Icon name="compass" size={20} /></span>
            {t('decision.title')}
          </DialogTitle>
          <DialogDescription className="text-t14 text-muted-foreground">{t('decision.subtitle')}</DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('decision.placeholder')}
          rows={3}
          className="resize-none rounded-xl border-gold/25 bg-white/70 text-t14 focus-visible:ring-gold/30"
          maxLength={400}
        />

        <GoldButton onClick={compute} disabled={loading || !text.trim()} className="w-full">
          {loading ? t('common.calculating') : t('decision.compute')} <Icon name="sparkle" size={15} />
        </GoldButton>

        {error && <p className="text-t14 text-maroon">{error}</p>}

        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-3">
            <div
              className={cn(
                'rounded-2xl px-4 py-3.5 border',
                result.verdict === 'favorable'
                  ? 'bg-gold-faint border-gold/40'
                  : result.verdict === 'mixed'
                    ? 'bg-gold-faint/60 border-gold/30'
                    : 'bg-maroon-soft border-maroon/30',
              )}
            >
              <p className={cn('font-serif text-t20 font-bold', result.verdict === 'wait' ? 'text-maroon' : 'text-charcoal')}>
                {t('decision.verdict.' + result.verdict)}
                <span className="text-t12 text-muted-foreground font-normal ml-2">{result.score}/100</span>
              </p>
              <p className="mt-1.5 text-t14 text-charcoal/85 leading-relaxed">{result.narrative}</p>
            </div>

            <div>
              <p className="text-t12 uppercase tracking-wide font-semibold text-gold mb-1.5">{t('decision.factors')}</p>
              <ul className="space-y-1.5">
                {result.factors.map((f, i) => (
                  <li key={i} className="text-t12 text-charcoal/80 flex gap-2">
                    <span className="text-gold mt-0.5 shrink-0"><Icon name="star" size={12} /></span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-t12 uppercase tracking-wide font-semibold text-gold mb-1.5">{t('decision.windows')}</p>
              {result.windows.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {result.windows.map((w) => (
                    <span key={w} className="rounded-full gold-grad px-3 py-1 text-t12 font-semibold text-charcoal">{w}</span>
                  ))}
                </div>
              ) : (
                <p className="text-t12 text-muted-foreground">{t('decision.windowsEmpty')}</p>
              )}
            </div>
            <p className="text-t12 text-muted-foreground/70 italic">{t('decision.disclaimer')}</p>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
