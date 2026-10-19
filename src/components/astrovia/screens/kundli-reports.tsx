'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons';
import { GlassCard, SectionHeader, EmptyState, Chip, ProgressBar, DignityChip, GhostButton } from '../ui-primitives';
import { useSession } from '../session-context';
import { PLANET_ORDER, SIGNS, SIGNS_HI, type PlanetKey } from '@/lib/astro/constants';
import { VARGA_LIST, VARGA_INFO } from '@/lib/astro/varga';
import { dignityOf } from '@/lib/astro/dignity';
import { daysSince as daysIn, daysUntil, pctBetween } from '@/lib/dates';
import { NorthChart } from './chart-diagram';
import { cn } from '@/lib/utils';

const BAV_KEYS: PlanetKey[] = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'];

/** Dasha-window progress: thin gold bar with a styled hover tooltip. */
function DashaProgress({ start, end, tipLabel }: { start: string; end: string; tipLabel: string }) {
  const pct = pctBetween(start, end);
  return (
    <div className="mt-2">
      <div className="dasha-tip-host">
        <div className="h-1.5 rounded-full bg-gold/15 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full gold-grad rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span role="tooltip" className="dasha-tip">
          {tipLabel}
        </span>
      </div>
    </div>
  );
}

export function ReportsScreen() {
  const { t, i18n } = useTranslation();
  const { chart } = useSession();
  const hi = i18n.language === 'hi';
  const [selectedVarga, setSelectedVarga] = useState<string>('D9');
  const [bavPlanet, setBavPlanet] = useState<PlanetKey>('Su');
  const [savOpen, setSavOpen] = useState<number | null>(null);

  const savMax = useMemo(() => (chart ? Math.max(...chart.ashtakavarga.sav) : 40), [chart]);

  if (!chart) return <EmptyState icon="timeline" title={t('home.noChart')} body={t('home.noChartBody')} />;

  const ds = chart.dashaSnapshot;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-t28 font-bold text-violet-grad">{t('reports.title')}</h1>
        <p className="text-t14 text-muted-foreground">{chart.input.name}</p>
      </header>

      {/* ── Current dasha (the full explorer lives in the Timeline tab) ── */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('reports.dasha')} icon="timeline" />
        {ds ? (
          <>
            <p className="text-t14 text-charcoal">
              <span className="gold-grad rounded-full px-3 py-1 inline-flex items-center gap-1.5 text-t12 font-semibold text-charcoal shadow-sm">
                <Icon name="clock" size={12} />
                {t('reports.current', { maha: t(`planet.${ds.mahaLord}`), antar: t(`planet.${ds.antarLord ?? 'Su'}`) })}
              </span>
            </p>
            {ds.antarStart && ds.antarEnd && (
              <>
                <p className="mt-3 text-t12 text-muted-foreground tabular-nums">
                  {ds.antarStart} → {ds.antarEnd}
                  {daysUntil(ds.antarEnd) > 0 && ` · ${t('timeline.endsIn', { n: daysUntil(ds.antarEnd) })}`}
                </p>
                <DashaProgress
                  start={ds.antarStart}
                  end={ds.antarEnd}
                  tipLabel={t('dasha.tipNow', {
                    d: daysIn(ds.antarStart),
                    left: Math.max(0, daysUntil(ds.antarEnd)),
                  })}
                />
              </>
            )}
          </>
        ) : (
          <p className="text-t12 text-muted-foreground">{t('timeline.noDasha')}</p>
        )}
        <GhostButton
          className="mt-3 h-9 px-3.5 text-t12"
          onClick={() =>
            window.dispatchEvent(new CustomEvent('ss:navigate', { detail: { tab: 'kundli', view: 'timeline' } }))
          }
        >
          <Icon name="timeline" size={14} /> {t('timeline.open')}
        </GhostButton>
      </GlassCard>

      {/* ── Divisional charts ── */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('reports.divisional')} icon="grid" />
        <p className="text-t12 text-muted-foreground mb-3">{t('reports.divisionalHint')}</p>
        <div className="flex gap-2 overflow-x-auto scroll-slim pb-2 -mx-1 px-1">
          {VARGA_LIST.map((v) => (
            <Chip key={v} active={selectedVarga === v} onClick={() => setSelectedVarga(v)}>
              {v}
            </Chip>
          ))}
        </div>
        {(() => {
          const vc = chart.divisionalCharts[selectedVarga as keyof typeof chart.divisionalCharts];
          if (!vc) return null;
          const vargaEntries = Object.entries(vc.planets) as [PlanetKey, number][];
          const isD9 = selectedVarga === 'D9';
          return (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-t14 font-semibold text-charcoal">{VARGA_INFO[selectedVarga as keyof typeof VARGA_INFO].en}</p>
                <p className="text-t12 text-muted-foreground">
                  Asc: {hi ? SIGNS_HI[vc.ascSign] : SIGNS[vc.ascSign]}
                </p>
              </div>
              <div className="max-h-[420px] overflow-y-auto scroll-slim rounded-xl bg-gold-faint/40 border border-gold/15 p-3">
                <div className="scale-[0.92] origin-top">
                  <NorthChart ascSign={vc.ascSign} planets={vargaEntries.map(([k, sign]) => ({ key: k as PlanetKey, sign: sign as number }))} />
                </div>
              </div>

              {/* Planet detail table for this varga */}
              <div className="mt-4">
                <p className="text-t12 uppercase tracking-wide font-semibold text-gold mb-2">{t('reports.vargaPlanets')}</p>
                <div className="rounded-xl border border-gold/15 overflow-hidden">
                  <table className="w-full text-t14">
                    <thead>
                      <tr className="bg-gold-soft/60 text-t12 text-muted-foreground">
                        <th className="text-left font-medium px-3 py-2">{t('reports.colPlanet')}</th>
                        <th className="text-left font-medium px-3 py-2">{t('reports.colSign')}</th>
                        <th className="text-center font-medium px-3 py-2">{t('reports.colHouse')}</th>
                        {isD9 && <th className="text-center font-medium px-3 py-2">{t('reports.colVargottama')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {PLANET_ORDER.filter((pk) => vargaEntries.some(([k]) => k === pk)).map((pk, rowIdx) => {
                        const sign = vargaEntries.find(([k]) => k === pk)![1];
                        const house = ((sign - vc.ascSign + 12) % 12) + 1;
                        const natalSign = chart.planets.find((p) => p.key === pk)?.sign;
                        const vargottama = isD9 && natalSign !== undefined && natalSign === sign;
                        const dignity = isD9 ? dignityOf(pk, sign) : null;
                        return (
                          <tr
                            key={pk}
                            className={cn(
                              'border-t border-gold/10 transition-colors duration-150 hover:bg-gold-faint/60',
                              rowIdx % 2 === 1 && 'bg-white/35',
                            )}
                          >
                            <td className="px-3 py-2 font-medium text-charcoal">{t(`planet.${pk}`)}</td>
                            <td className="px-3 py-2 text-charcoal/80">
                              <span className="inline-flex items-center gap-2 flex-wrap">
                                {hi ? SIGNS_HI[sign] : SIGNS[sign]}
                                {isD9 && dignity && <DignityChip dignity={dignity} />}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center text-charcoal/80">{house}</td>
                            {isD9 && (
                              <td className="px-3 py-2 text-center">
                                {vargottama && (
                                  <span className="inline-flex items-center rounded-full bg-gold-soft border border-gold/40 px-2 py-0.5 text-t12 text-[#8a6d10] font-semibold">
                                    <Icon name="star" size={11} className="mr-1" />
                                    {t('reports.vargottama')}
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {isD9 && (
                  <p className="mt-1.5 text-t12 text-muted-foreground">{t('reports.vargottamaHint')} {t('reports.dignityHint')}</p>
                )}
              </div>
            </div>
          );
        })()}
      </GlassCard>

      {/* ── Ashtakavarga ── */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('reports.ashtakavarga')} icon="chart" />
        <p className="text-t12 text-muted-foreground mb-3">{t('reports.savHint')}</p>
        <p className="text-t12 uppercase tracking-wide font-semibold text-gold mb-2">{t('reports.sav')}</p>
        <p className="text-t12 text-muted-foreground mb-2 -mt-1">{t('reports.savTapHint')}</p>
        <div className="space-y-1.5 max-h-96 overflow-y-auto scroll-slim pr-1">
          {chart.ashtakavarga.sav.map((v, i) => {
            const open = savOpen === i;
            return (
              <div key={i} className={cn('rounded-xl transition-colors duration-200', open && 'bg-gold-faint/60 border border-gold/25')}>
                <button
                  type="button"
                  onClick={() => setSavOpen(open ? null : i)}
                  aria-expanded={open}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left hover:bg-gold-faint/50 active:scale-[0.99] transition-all duration-200"
                >
                  <span className="w-20 text-t12 text-muted-foreground truncate">{hi ? SIGNS_HI[i] : SIGNS[i]}</span>
                  <ProgressBar value={(v / savMax) * 100} className={cn('flex-1', v >= 28 ? '' : 'opacity-70')} />
                  <span className={cn('w-8 text-right text-t14 font-bold', v >= 28 ? 'text-[#8a6d10]' : v < 25 ? 'text-burgundy' : 'text-charcoal')}>{v}</span>
                  <Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} className="text-gold/70 shrink-0" />
                </button>
                {open && (
                  <div className="px-2.5 pb-2.5 pt-1 animate-in fade-in-50 duration-200">
                    <p className="text-t12 text-muted-foreground mb-1.5">{t('reports.savContribution', { sign: hi ? SIGNS_HI[i] : SIGNS[i] })}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {BAV_KEYS.map((k) => {
                        const bindu = chart.ashtakavarga.bav[k][i] as number;
                        return (
                          <span
                            key={k}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-t12',
                              bindu >= 4
                                ? 'bg-gold-soft/70 border-gold/50 text-[#7a5c10] font-semibold'
                                : bindu <= 1
                                  ? 'bg-burgundy-soft/70 border-burgundy/25 text-burgundy/80'
                                  : 'bg-white/60 border-gold/15 text-charcoal/75',
                            )}
                            title={t(`planet.${k}`)}
                          >
                            <span className="opacity-70">{t(`planet.${k}`)}</span>
                            <span className="font-bold">{bindu}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <p className="text-t12 uppercase tracking-wide font-semibold text-gold mb-2">
            {t('reports.bav', { planet: t(`planet.${bavPlanet}`) })}
          </p>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {BAV_KEYS.map((k) => (
              <Chip key={k} active={bavPlanet === k} onClick={() => setBavPlanet(k)} compact>
                {t(`planet.${k}`)}
              </Chip>
            ))}
          </div>
          <div className="overflow-x-auto scroll-slim">
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 min-w-[420px]">
              {chart.ashtakavarga.bav[bavPlanet].map((bindu: number, si: number) => (
                <div key={si} className="rounded-lg border border-gold/20 bg-white/50 px-1 py-2 text-center">
                  <p className="text-t12 text-muted-foreground truncate">{hi ? SIGNS_HI[si].slice(0, 3) : SIGNS[si].slice(0, 3)}</p>
                  <p className={cn('text-t16 font-bold mt-0.5', bindu >= 4 ? 'text-[#8a6d10]' : bindu <= 1 ? 'text-burgundy/70' : 'text-charcoal')}>
                    {bindu}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ── Doshas ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <GlassCard className={cn('p-4 sm:p-5', chart.mangalDosha.severity !== 'none' && !chart.mangalDosha.mitigated && 'border-burgundy/35 border-l-4 border-l-burgundy/60')}>
          <SectionHeader title={t('reports.mangal')} icon="shield" />
          <p className={cn('inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-t14 font-semibold', chart.mangalDosha.severity === 'none' ? 'bg-emerald-soft text-emerald-deep border border-emerald/30' : 'burgundy-grad text-white shadow-[0_2px_10px_rgba(92,26,40,0.35)]')}>
            <Icon name={chart.mangalDosha.severity === 'none' ? 'check' : 'warning'} size={15} />
            {t(`reports.severity.${chart.mangalDosha.severity}`)}
          </p>
          <ul className="mt-3 space-y-1.5">
            <li className="text-t12 text-muted-foreground">{t('reports.marsFromAsc', { house: chart.mangalDosha.marsHouseFromAsc })}</li>
            <li className="text-t12 text-muted-foreground">{t('reports.marsFromMoon', { house: chart.mangalDosha.marsHouseFromMoon })}</li>
            {chart.mangalDosha.reasons.map((r, i) => (
              <li key={i} className="text-t12 text-charcoal/80 italic">{r}</li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard className={cn('p-4 sm:p-5', chart.sadeSati.active && 'border-burgundy/35 border-l-4 border-l-burgundy/60')}>
          <SectionHeader title={t('reports.sadeSati')} icon="planet" />
          <p className={cn('inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-t14 font-semibold border', chart.sadeSati.active ? 'bg-burgundy-soft text-burgundy border-burgundy/30' : 'bg-emerald-soft text-emerald-deep border-emerald/30')}>
            <Icon name={chart.sadeSati.active ? 'warning' : 'check'} size={15} />
            {chart.sadeSati.active ? t('reports.sadeSati.active', { phase: t(`reports.phase.${chart.sadeSati.phase}`) }) : t('reports.sadeSati.inactive')}
          </p>
          {chart.sadeSati.window && (
            <p className="mt-3 text-t12 text-muted-foreground">
              {t('reports.sadeSati.window')}: <span className="text-charcoal font-medium">{chart.sadeSati.window.start} → {chart.sadeSati.window.end}</span>
            </p>
          )}
          <p className="mt-2 text-t12 text-charcoal/75 leading-relaxed">{chart.sadeSati.note}</p>
          <p className="mt-1.5 text-t12 text-muted-foreground italic">{t('reports.sadeSati.about')}</p>
        </GlassCard>
      </div>
    </div>
  );
}
