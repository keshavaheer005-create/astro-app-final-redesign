'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons';
import { GlassCard, SectionHeader, EmptyState, Chip, ProgressBar } from '../ui-primitives';
import { useSession } from '../session-context';
import { PLANET_ORDER, SIGNS, SIGNS_HI, type PlanetKey } from '@/lib/astro/constants';
import { VARGA_LIST, VARGA_INFO } from '@/lib/astro/varga';
import { NorthChart } from './chart-diagram';
import { cn } from '@/lib/utils';

const BAV_KEYS: PlanetKey[] = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'];

export function ReportsScreen() {
  const { t, i18n } = useTranslation();
  const { chart } = useSession();
  const hi = i18n.language === 'hi';
  const [selectedVarga, setSelectedVarga] = useState<string>('D9');
  const [bavPlanet, setBavPlanet] = useState<PlanetKey>('Su');
  const [showAntars, setShowAntars] = useState(true);

  const savMax = useMemo(() => (chart ? Math.max(...chart.ashtakavarga.sav) : 40), [chart]);

  if (!chart) return <EmptyState icon="timeline" title={t('home.noChart')} body={t('home.noChartBody')} />;

  const ds = chart.dashaSnapshot;
  const nowStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-t28 font-bold text-charcoal">{t('reports.title')}</h1>
        <p className="text-t14 text-muted-foreground">{chart.input.name}</p>
      </header>

      {/* ── Vimshottari dasha timeline ── */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('reports.dasha')} icon="timeline" />
        {ds && (
          <p className="text-t14 text-charcoal mb-4">
            <span className="gold-grad rounded-full px-3 py-1 inline-flex items-center gap-1.5 text-t12 font-semibold text-charcoal shadow-sm">
              <Icon name="clock" size={12} />
              {t('reports.current', { maha: t(`planet.${ds.mahaLord}`), antar: t(`planet.${ds.antarLord ?? 'Su'}`) })}
            </span>
          </p>
        )}
        <div className="overflow-x-auto scroll-slim pb-2 -mx-1 px-1">
          <div className="flex gap-2 min-w-max max-w-full">
            {chart.dashas.mahadashas.map((md) => {
              const isCurrent = ds && md.lord === ds.mahaLord;
              const isPast = md.end < nowStr;
              const isFuture = md.start > nowStr;
              return (
                <div
                  key={md.lord + md.start}
                  className={cn(
                    'rounded-xl border px-3.5 py-3 min-w-[130px] transition-all duration-250',
                    isCurrent
                      ? 'glass-ink border-gold/40 scale-[1.02]'
                      : isPast
                        ? 'bg-white/35 border-gold/10 opacity-60'
                        : 'bg-white/60 border-gold/20',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('font-semibold text-t14', isCurrent ? 'text-gold-light' : 'text-charcoal')}>
                      {t(`planet.${md.lord}`)}
                    </span>
                    <span className="text-t12 text-muted-foreground">{md.years} {t('common.years')}</span>
                  </div>
                  <p className="text-t12 text-muted-foreground mt-1">{md.start}</p>
                  <p className="text-t12 text-muted-foreground">→ {md.end}</p>
                </div>
              );
            })}
          </div>
        </div>

        {ds && showAntars && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowAntars((v) => !v)}
              className="text-t12 text-gold inline-flex items-center gap-1 hover:underline"
            >
              <Icon name="chevron-down" size={13} /> {t('reports.antar')} — {t(`planet.${ds.mahaLord}`)}
            </button>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto scroll-slim pr-1">
              {chart.dashas.current?.maha.antardashas.map((ad) => {
                const active = ds.antarLord === ad.lord;
                return (
                  <div
                    key={ad.lord + ad.start}
                    className={cn(
                      'rounded-lg px-3 py-2 border text-t12 transition-colors duration-200',
                      active ? 'gold-grad border-gold/40 font-semibold text-charcoal' : 'bg-white/50 border-gold/15 text-muted-foreground',
                    )}
                  >
                    <span className="font-medium text-t14 text-charcoal">{t(`planet.${ad.lord}`)}</span>
                    <span className="block">{ad.start} → {ad.end}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
                        return (
                          <tr
                            key={pk}
                            className={cn(
                              'border-t border-gold/10 transition-colors duration-150 hover:bg-gold-faint/60',
                              rowIdx % 2 === 1 && 'bg-white/35',
                            )}
                          >
                            <td className="px-3 py-2 font-medium text-charcoal">{t(`planet.${pk}`)}</td>
                            <td className="px-3 py-2 text-charcoal/80">{hi ? SIGNS_HI[sign] : SIGNS[sign]}</td>
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
                  <p className="mt-1.5 text-t12 text-muted-foreground">{t('reports.vargottamaHint')}</p>
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
        <div className="space-y-1.5 max-h-80 overflow-y-auto scroll-slim pr-1">
          {chart.ashtakavarga.sav.map((v, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="w-20 text-t12 text-muted-foreground truncate">{hi ? SIGNS_HI[i] : SIGNS[i]}</span>
              <ProgressBar value={(v / savMax) * 100} className={cn('flex-1', v >= 28 ? '' : 'opacity-70')} />
              <span className={cn('w-8 text-right text-t14 font-bold', v >= 28 ? 'text-[#8a6d10]' : v < 25 ? 'text-maroon' : 'text-charcoal')}>{v}</span>
            </div>
          ))}
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
                  <p className={cn('text-t16 font-bold mt-0.5', bindu >= 4 ? 'text-[#8a6d10]' : bindu <= 1 ? 'text-maroon/70' : 'text-charcoal')}>
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
        <GlassCard className={cn('p-4 sm:p-5', chart.mangalDosha.severity !== 'none' && !chart.mangalDosha.mitigated && 'border-maroon/30')}>
          <SectionHeader title={t('reports.mangal')} icon="shield" />
          <p className={cn('inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-t14 font-semibold', chart.mangalDosha.severity === 'none' ? 'bg-gold-faint text-[#7a8b6f]' : 'bg-maroon-soft text-maroon')}>
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

        <GlassCard className={cn('p-4 sm:p-5', chart.sadeSati.active && 'border-maroon/30')}>
          <SectionHeader title={t('reports.sadeSati')} icon="planet" />
          <p className={cn('inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-t14 font-semibold', chart.sadeSati.active ? 'bg-maroon-soft text-maroon' : 'bg-gold-faint text-[#7a8b6f]')}>
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
