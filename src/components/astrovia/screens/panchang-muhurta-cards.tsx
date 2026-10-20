'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons';
import { GlassCard, SectionHeader } from '../ui-primitives';
import { cn } from '@/lib/utils';

type Quality = 'good' | 'medium' | 'bad';

export interface MuhurtaPayload {
  hora: { planet: string; part: 'day' | 'night'; quality: Quality; startISO: string; endISO: string }[];
  vijaya: { startISO: string; endISO: string };
  yamaganda: { startISO: string; endISO: string };
  gulika: { startISO: string; endISO: string };
  siddhi: { kind: 'sarvartha' | 'amrit'; nakshatra: string; nakshatraHi: string; startISO: string; endISO: string }[];
  bhadra: { startISO: string; endISO: string }[];
  panchak: { inEffect: boolean; startsToday: boolean; startISO: string | null; endISO: string | null };
}

export interface PersonalPayload {
  tara: { number: number; name: string; quality: Quality };
  chandra: { house: number; quality: Quality };
}

const QUALITY_STYLE: Record<Quality, string> = {
  good: 'bg-gold-faint border-gold/40 text-[#7a8b6f]',
  medium: 'bg-white/55 border-gold/20 text-muted-foreground',
  bad: 'bg-burgundy-soft/80 border-burgundy/25 text-burgundy',
};

interface Fmt {
  time: (iso: string | null) => string;
  dateTime: (iso: string | null) => string;
}

export function PanchangMuhurtaCards({
  extras,
  personal,
  fmt,
  language,
}: {
  extras: MuhurtaPayload;
  personal: PersonalPayload | null;
  fmt: Fmt;
  language: string;
}) {
  const { t } = useTranslation();
  const [part, setPart] = useState<'day' | 'night'>('day');
  const nowMs = Date.now();
  const slots = extras.hora.filter((h) => h.part === part);
  const current = extras.hora.find((h) => nowMs >= new Date(h.startISO).getTime() && nowMs < new Date(h.endISO).getTime());
  const hasCautions = extras.bhadra.length > 0 || extras.panchak.inEffect || extras.panchak.startsToday;

  return (
    <>
      {/* ── For you (Tara-bala & Chandra-bala) ── */}
      {personal && (
        <GlassCard className="p-4 sm:p-5">
          <SectionHeader title={t('personal.title')} icon="user" />
          <div className="grid grid-cols-2 gap-3">
            <div className={cn('rounded-xl border px-3 py-2.5', QUALITY_STYLE[personal.tara.quality])}>
              <p className="text-t12 font-semibold uppercase tracking-wide">{t('personal.tara')}</p>
              <p className="mt-0.5 font-serif text-t16 text-charcoal">{personal.tara.name}</p>
              <p className="mt-0.5 text-t12 leading-snug">{t(`personal.taraNote.${personal.tara.quality}`)}</p>
            </div>
            <div className={cn('rounded-xl border px-3 py-2.5', QUALITY_STYLE[personal.chandra.quality])}>
              <p className="text-t12 font-semibold uppercase tracking-wide">{t('personal.chandra')}</p>
              <p className="mt-0.5 font-serif text-t16 text-charcoal">{t('personal.chandraHouse', { house: personal.chandra.house })}</p>
              <p className="mt-0.5 text-t12 leading-snug">{t(`personal.chandraNote.${personal.chandra.quality}`)}</p>
            </div>
          </div>
          <p className="mt-2 text-t12 text-muted-foreground/90">{t('personal.hint')}</p>
        </GlassCard>
      )}

      {/* ── Hora ── */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('hora.title')} icon="planet" />
        <div className="mb-3 inline-flex rounded-full border border-gold/25 bg-white/55 p-1" role="tablist">
          {(['day', 'night'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={part === p}
              onClick={() => setPart(p)}
              className={cn(
                'tap-sm rounded-full px-3.5 py-1 text-t12 transition-colors duration-200',
                part === p ? 'bg-gold-faint font-medium text-charcoal' : 'text-muted-foreground hover:text-charcoal',
              )}
            >
              {t(`hora.${p}`)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((s) => {
            const isNow = current?.startISO === s.startISO;
            return (
              <div
                key={s.startISO}
                className={cn(
                  'rounded-lg border px-1.5 py-2 text-center transition-all duration-200',
                  QUALITY_STYLE[s.quality],
                  isNow && 'scale-[1.03] shadow-[0_2px_10px_rgba(201,162,39,0.3)] ring-2 ring-gold',
                )}
              >
                <p className="text-t12 font-semibold">{t(`hora.planet.${s.planet}`)}</p>
                <p className="mt-0.5 text-[11px] leading-tight opacity-90">
                  {fmt.time(s.startISO)}
                  <br />
                  {fmt.time(s.endISO)}
                </p>
              </div>
            );
          })}
        </div>
        {current && (
          <p className="mt-3 rounded-xl bg-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] px-3 py-2 text-t12 leading-relaxed text-charcoal/85">
            <span className="font-semibold text-charcoal">{t('hora.now', { planet: t(`hora.planet.${current.planet}`) })}</span>{' '}
            {t(`hora.suits.${current.planet}`)}
          </p>
        )}
      </GlassCard>

      {/* ── More windows ── */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('windows.title')} icon="clock" />
        <ul className="space-y-2.5">
          <WindowRow tone="good" name={t('muhurta.vijaya')} note={t('muhurta.vijayaNote')} time={`${fmt.time(extras.vijaya.startISO)} – ${fmt.time(extras.vijaya.endISO)}`} />
          <WindowRow tone="bad" name={t('muhurta.yamaganda')} note={t('muhurta.yamagandaNote')} time={`${fmt.time(extras.yamaganda.startISO)} – ${fmt.time(extras.yamaganda.endISO)}`} />
          <WindowRow tone="bad" name={t('muhurta.gulika')} note={t('muhurta.gulikaNote')} time={`${fmt.time(extras.gulika.startISO)} – ${fmt.time(extras.gulika.endISO)}`} />
        </ul>
      </GlassCard>

      {/* ── Special yogas & cautions ── */}
      <GlassCard className="p-4 sm:p-5">
        <SectionHeader title={t('yogas.title')} icon="sparkle" />
        {extras.siddhi.length === 0 && !hasCautions && <p className="text-t14 text-muted-foreground">{t('yogas.none')}</p>}
        <ul className="space-y-2.5">
          {extras.siddhi.map((s) => (
            <WindowRow
              key={s.kind + s.startISO}
              tone="good"
              name={t(`yogas.${s.kind}`)}
              note={t(`yogas.${s.kind}Note`, { nakshatra: language === 'hi' ? s.nakshatraHi : s.nakshatra })}
              time={`${fmt.time(s.startISO)} – ${fmt.dateTime(s.endISO)}`}
            />
          ))}
          {extras.bhadra.map((b) => (
            <WindowRow key={b.startISO} tone="bad" name={t('yogas.bhadra')} note={t('yogas.bhadraNote')} time={`${fmt.time(b.startISO)} – ${fmt.dateTime(b.endISO)}`} />
          ))}
          {(extras.panchak.inEffect || extras.panchak.startsToday) && (
            <WindowRow
              tone="bad"
              name={t('yogas.panchak')}
              note={t(extras.panchak.inEffect ? 'yogas.panchakOn' : 'yogas.panchakStarts')}
              time={
                extras.panchak.endISO
                  ? `${extras.panchak.startsToday ? fmt.time(extras.panchak.startISO) : '…'} – ${fmt.dateTime(extras.panchak.endISO)}`
                  : ''
              }
            />
          )}
        </ul>
      </GlassCard>
    </>
  );
}

function WindowRow({ tone, name, note, time }: { tone: 'good' | 'bad'; name: string; note: string; time: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={cn(
          'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          tone === 'good' ? 'bg-emerald-soft/80 text-emerald-deep' : 'bg-burgundy-soft/80 text-burgundy',
        )}
      >
        <Icon name={tone === 'good' ? 'check' : 'warning'} size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-t14 font-semibold text-charcoal">{name}</p>
          {time && <p className="text-t12 font-medium text-charcoal/80">{time}</p>}
        </div>
        <p className="text-t12 leading-snug text-muted-foreground">{note}</p>
      </div>
    </li>
  );
}
