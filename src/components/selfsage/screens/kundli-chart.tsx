'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons';
import { GlassCard, Segmented, SectionHeader, EmptyState, DignityChip } from '../ui-primitives';
import { NorthChart, SouthChart } from './chart-diagram';
import { useSession } from '../session-context';
import { PLANET_ORDER, SIGNS, SIGNS_HI } from '@/lib/astro/constants';
import { dignityOf } from '@/lib/astro/dignity';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';

export function KundliChartScreen() {
  const { t, i18n } = useTranslation();
  const { chart } = useSession();
  const [style, setStyle] = useState<'north' | 'south'>('north');
  const [zodiac, setZodiac] = useState<'vedic' | 'western' | 'both'>('vedic');
  const hi = i18n.language === 'hi';

  const signName = (i: number) => (hi ? SIGNS_HI[i] : SIGNS[i]);

  const agreement = useMemo(() => {
    if (!chart) return { same: [] as string[], different: [] as string[] };
    const same: string[] = [];
    const different: string[] = [];
    for (const p of chart.planets) {
      const sid = p.sign;
      const trop = Math.floor(p.lonTropical / 30) % 12;
      if (sid === trop) same.push(t(`planet.${p.key}`));
      else different.push(t(`planet.${p.key}`));
    }
    return { same, different };
  }, [chart, t]);

  if (!chart) {
    return <EmptyState icon="chart" title={t('home.noChart')} body={t('home.noChartBody')} />;
  }

  const asc = chart.ascendant;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-t28 font-bold text-gold-grad">{chart.input.name}</h1>
        <p className="text-t12 text-muted-foreground mt-0.5">
          {chart.input.dob} · {chart.input.tob} · {chart.input.placeName ?? ''} · ayanamsa {chart.ayanamsa.toFixed(2)}°
        </p>
      </header>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryTile label={t('chart.ascSummary')} value={hi ? asc.signNameHi : asc.signName} sub={`${asc.degInSign.toFixed(1)}° · ${asc.nakshatra}`} icon="compass" tone="gold" />
        <SummaryTile label={t('chart.moonSummary')} value={hi ? chart.moonSign.nameHi : chart.moonSign.name} sub={chart.planets.find((p) => p.key === 'Mo')?.nakshatraName} icon="moon" tone="violet" />
        <SummaryTile label={t('chart.sunSummary')} value={hi ? chart.sunSign.nameHi : chart.sunSign.name} sub={chart.planets.find((p) => p.key === 'Su')?.nakshatraName} icon="sun" tone="gold" />
      </div>

      {/* Toggles — labelled segmented controls (no loose chip wrapping) */}
      <div className="grid gap-2.5 sm:grid-cols-2 sm:items-end" role="group" aria-label={t('chart.group.toggles')}>
        <Segmented
          label={t('chart.group.style')}
          options={[
            { id: 'north', label: t('chart.north') },
            { id: 'south', label: t('chart.south') },
          ]}
          active={style}
          onChange={(v) => setStyle(v as 'north' | 'south')}
        />
        <Segmented
          label={t('chart.group.zodiac')}
          options={[
            { id: 'vedic', label: t('chart.zodiac.vedic') },
            { id: 'western', label: t('chart.zodiac.western') },
            { id: 'both', label: t('chart.zodiac.both') },
          ]}
          active={zodiac}
          onChange={(v) => setZodiac(v as 'vedic' | 'western' | 'both')}
        />
      </div>

      {/* Chart diagrams */}
      {zodiac !== 'western' && (
        <GlassCard className="p-4 sm:p-6">
          <p className="text-t12 uppercase tracking-wider text-gold font-semibold mb-3">{t('chart.zodiac.vedic')}</p>
          {style === 'north' ? (
            <NorthChart ascSign={asc.sign} planets={chart.planets.map((p) => ({ key: p.key, sign: p.sign, retrograde: p.retrograde }))} />
          ) : (
            <SouthChart ascSign={asc.sign} planets={chart.planets.map((p) => ({ key: p.key, sign: p.sign, retrograde: p.retrograde }))} />
          )}
        </GlassCard>
      )}

      {zodiac !== 'vedic' && (
        <GlassCard className="p-4 sm:p-6">
          <p className="text-t12 uppercase tracking-wider text-gold font-semibold mb-3">{t('chart.zodiac.western')}</p>
          {style === 'north' ? (
            <NorthChart
              ascSign={Math.floor(chart.planets.length ? 0 : 0) + signIndexOfTropicalAsc(chart)}
              planets={chart.planets.map((p) => ({ key: p.key, sign: Math.floor(p.lonTropical / 30) % 12, retrograde: p.retrograde }))}
            />
          ) : (
            <SouthChart
              ascSign={signIndexOfTropicalAsc(chart)}
              planets={chart.planets.map((p) => ({ key: p.key, sign: Math.floor(p.lonTropical / 30) % 12, retrograde: p.retrograde }))}
            />
          )}
        </GlassCard>
      )}

      {zodiac === 'both' && (
        <GlassCard className="p-5">
          <SectionHeader title={t('chart.agreement')} icon="eye" />
          {agreement.same.length > 0 ? (
            <p className="text-t14 text-charcoal leading-relaxed">
              {t('chart.agreeLine', { count: agreement.same.length, list: agreement.same.join(', ') })}
            </p>
          ) : (
            <p className="text-t14 text-muted-foreground leading-relaxed">
              {t('chart.disagreeLine', { deg: chart.ayanamsa.toFixed(1) })}
            </p>
          )}
        </GlassCard>
      )}

      {/* Planets table */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('chart.planetsTable')} icon="list" />
        <div className="overflow-x-auto scroll-slim -mx-1 px-1">
          <table className="w-full text-t14 min-w-[520px]">
            <thead>
              <tr className="text-t12 text-muted-foreground border-b border-gold/20">
                <th className="text-left py-2 font-medium">—</th>
                <th className="text-left py-2 font-medium">{t('chart.sign')}</th>
                <th className="text-left py-2 font-medium">{t('chart.degree')}</th>
                <th className="text-left py-2 font-medium">{t('chart.nakshatraCol')}</th>
                <th className="text-left py-2 font-medium">{t('chart.house')}</th>
              </tr>
            </thead>
            <tbody>
              {chart.planets.map((p) => (
                <tr key={p.key} className="border-b border-gold/10 last:border-0 hover:bg-gold-soft/40 transition-colors duration-150">
                  <td className="py-2.5">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-charcoal">
                      {t(`planet.${p.key}`)}
                      {p.retrograde && <span className="text-t12 text-burgundy font-bold">℞</span>}
                    </span>
                  </td>
                  <td className="py-2.5 text-charcoal/85">
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      {hi ? SIGNS_HI[p.sign] : p.signName}
                      {dignityOf(p.key, p.sign) && <DignityChip dignity={dignityOf(p.key, p.sign)!} />}
                      <span className="text-muted-foreground text-t12">({p.house})</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-muted-foreground">{p.degInSign.toFixed(2)}°</td>
                  <td className="py-2.5 text-charcoal/85">{p.nakshatraName} <span className="text-t12 text-muted-foreground">·{p.pada}</span></td>
                  <td className="py-2.5"><span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-gold-soft text-t12 font-bold text-[#8a6d10]">{p.house}</span></td>
                </tr>
              ))}
              <tr className="hover:bg-gold-soft/40 transition-colors duration-150">
                <td className="py-2.5 font-semibold text-charcoal">{t('chart.ascSummary')}</td>
                <td className="py-2.5 text-charcoal/85">{hi ? asc.signNameHi : asc.signName}</td>
                <td className="py-2.5 text-muted-foreground">{asc.degInSign.toFixed(2)}°</td>
                <td className="py-2.5 text-charcoal/85">{asc.nakshatra} <span className="text-t12 text-muted-foreground">·{asc.pada}</span></td>
                <td className="py-2.5"><span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-gold-soft text-t12 font-bold text-[#8a6d10]">1</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

function signIndexOfTropicalAsc(chart: NonNullable<ReturnType<typeof useSession>['chart']>): number {
  // tropical asc = sidereal asc + ayanamsa
  const lon = (chart.ascendant.lon + chart.ayanamsa) % 360;
  return Math.floor(lon / 30) % 12;
}

function SummaryTile({ label, value, sub, icon, tone = 'gold' }: { label: string; value: string; sub?: string; icon: 'compass' | 'moon' | 'sun'; tone?: 'gold' | 'violet' }) {
  return (
    <GlassCard className="p-3.5 sm:p-4">
      <div className={cn('flex items-center gap-2', tone === 'violet' ? 'text-violet' : 'text-gold')}>
        <Icon name={icon} size={16} className="shrink-0" />
        <span className="text-t12 text-muted-foreground leading-tight">{label}</span>
      </div>
      <p className="mt-1.5 font-serif text-t16 sm:text-t20 font-semibold text-charcoal leading-snug line-clamp-2" title={value}>{value}</p>
      {sub && <p className="text-t12 text-muted-foreground leading-snug line-clamp-2" title={sub}>{sub}</p>}
    </GlassCard>
  );
}
