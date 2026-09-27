'use client';

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { MandalaAccent } from '../chakra';
import { KundliChartScreen } from './kundli-chart';
import { PanchangScreen } from './kundli-panchang';
import { HoroscopeScreen } from './kundli-horoscope';
import { MatchingScreen } from './kundli-matching';
import { ReportsScreen } from './kundli-reports';

export type KundliView = 'chart' | 'panchang' | 'horoscope' | 'matching' | 'reports';

/* Per-view atmosphere — secondary tint domains (gold stays the CTA colour):
   chart/panchang sit in the golden daylight band, horoscope/reports in
   violet insight, matching in rose harmony. */
const VIEW_TONE: Record<KundliView, { wash: string; accent: string }> = {
  chart: { wash: 'wash-gold', accent: 'text-gold' },
  panchang: { wash: 'wash-gold', accent: 'text-gold' },
  horoscope: { wash: 'wash-violet', accent: 'text-violet' },
  matching: { wash: 'wash-rose', accent: 'text-rose' },
  reports: { wash: 'wash-violet', accent: 'text-violet' },
};

export function KundliTab({ initialView }: { initialView?: KundliView }) {
  const { t } = useTranslation();
  const [view, setView] = useState<KundliView>(initialView ?? 'chart');

  // Sliding violet pill indicator (transform 260ms ease) — same mechanics as the
  // profile language switcher. Violet = the Kundli mystical/insight domain;
  // the shared SlidingPillTabs stays gold for the horoscope sub-tabs.
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ x: 0, w: 0, ready: false });
  const [fade, setFade] = useState({ left: false, right: false });

  const tabs = useMemo(
    () => [
      { id: 'chart' as const, label: t('kundli.tab.chart') },
      { id: 'panchang' as const, label: t('kundli.tab.panchang') },
      { id: 'horoscope' as const, label: t('kundli.tab.horoscope') },
      { id: 'matching' as const, label: t('kundli.tab.matching') },
      { id: 'reports' as const, label: t('kundli.tab.reports') },
    ],
    [t],
  );

  // Edge fades appear only while the strip overflows — signals more tabs are
  // reachable by swiping without truncating labels.
  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setFade({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useLayoutEffect(() => {
    const idx = tabs.findIndex((tab) => tab.id === view);
    const el = tabRefs.current[idx];
    if (el) {
      setPill({ x: el.offsetLeft, w: el.offsetWidth, ready: true });
      // Keep the active tab visible inside the scrollable strip (the strip is
      // its own horizontal scroll container; the page never pans).
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
    updateFade();
  }, [view, tabs, updateFade]);

  return (
    <div className="relative space-y-4">
      {/* Per-view atmosphere: soft colour wash + a slowly turning corner
          mandala that cross-fades its tint with the active view */}
      <div className={cn('wash -z-10', VIEW_TONE[view].wash)} aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-10 -right-4 opacity-[0.12] transition-colors duration-700"
        aria-hidden="true"
      >
        <MandalaAccent size={190} className={cn('chakra-spin-zodiac', VIEW_TONE[view].accent)} />
      </div>
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={updateFade}
          className="relative flex rounded-full border border-violet/25 bg-violet-faint/80 p-1 backdrop-blur-md overflow-x-auto no-scrollbar"
        >
          <span
            aria-hidden="true"
            className="absolute top-1 bottom-1 rounded-full violet-grad shadow-[0_2px_10px_rgba(110,74,158,0.35)]"
            style={{
              transform: `translateX(${pill.x}px)`,
              width: pill.w,
              opacity: pill.ready ? 1 : 0,
              transition: 'transform 260ms ease, width 260ms ease, opacity 200ms ease',
            }}
          />
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              aria-pressed={view === tab.id}
              onClick={() => setView(tab.id)}
              className={cn(
                'tap-sm relative z-10 flex-1 min-w-fit h-11 rounded-full px-3.5 text-t14 font-medium transition-colors duration-250 ease-out',
                view === tab.id ? 'text-white' : 'text-muted-foreground hover:text-charcoal',
              )}
            >
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>
        {fade.left && (
          <div className="absolute left-0 top-0 bottom-0 w-7 rounded-l-full bg-gradient-to-r from-[#f6f2fa] to-transparent pointer-events-none transition-opacity duration-250" aria-hidden />
        )}
        {fade.right && (
          <div className="absolute right-0 top-0 bottom-0 w-7 rounded-r-full bg-gradient-to-l from-[#f6f2fa] to-transparent pointer-events-none transition-opacity duration-250" aria-hidden />
        )}
      </div>
      <div key={view} className="stagger-in">
        {view === 'chart' && <KundliChartScreen />}
        {view === 'panchang' && <PanchangScreen />}
        {view === 'horoscope' && <HoroscopeScreen />}
        {view === 'matching' && <MatchingScreen />}
        {view === 'reports' && <ReportsScreen />}
      </div>
    </div>
  );
}
