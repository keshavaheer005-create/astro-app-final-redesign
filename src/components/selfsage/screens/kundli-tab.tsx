'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { MandalaAccent } from '../chakra';
import { useAppStore, type ScreenTone } from '@/store/app';
import { KundliChartScreen } from './kundli-chart';
import { PanchangScreen } from './kundli-panchang';
import { HoroscopeScreen } from './kundli-horoscope';
import { MatchingScreen } from './kundli-matching';
import { ReportsScreen } from './kundli-reports';

export type KundliView = 'chart' | 'panchang' | 'horoscope' | 'matching' | 'reports';

/* Per-view atmosphere — secondary tint domains (gold stays the CTA colour):
   chart/panchang sit in the golden daylight band, horoscope/reports in
   violet insight, matching in rose harmony. The tone drives BOTH the corner
   mandala accent and the full-viewport ScreenGradient (via the store). */
const VIEW_TONE: Record<KundliView, { accent: string; tone: ScreenTone }> = {
  chart: { accent: 'text-gold', tone: 'gold' },
  panchang: { accent: 'text-gold', tone: 'gold' },
  horoscope: { accent: 'text-violet', tone: 'violet' },
  matching: { accent: 'text-rose', tone: 'rose' },
  reports: { accent: 'text-violet', tone: 'violet' },
};

export function KundliTab({ initialView }: { initialView?: KundliView }) {
  const { t } = useTranslation();
  const [view, setView] = useState<KundliView>(initialView ?? 'chart');
  const setScreenTone = useAppStore((s) => s.setScreenTone);

  // This sub-tab owns the whole-screen atmosphere: switching views cross-fades
  // the fixed ScreenGradient (gold chart/panchang · violet horoscope/reports ·
  // rose matching). Cleanup resets to kundli's gold default on unmount.
  useEffect(() => {
    setScreenTone(VIEW_TONE[view].tone);
  }, [view, setScreenTone]);

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
      {/* Full-viewport gradient comes from ScreenGradient (store-driven);
          a slowly turning corner mandala cross-fades its tint with the view */}
      <div
        className="pointer-events-none absolute -top-10 -right-4 opacity-[0.12] transition-colors duration-700"
        aria-hidden="true"
      >
        <MandalaAccent size={190} className={cn('chakra-spin-zodiac', VIEW_TONE[view].accent)} />
      </div>
      <div className="relative">
        {/* Mobile-first segmented strip: labels NEVER truncate — on phones the
            pills keep their natural width and the track scrolls (snap + mask
            fades signal more tabs); from sm up pills share the width equally.
            The glass shell stays put; only the transparent track scrolls, so
            the mask fades labels without dissolving the bar itself. */}
        <div className="rounded-full border border-white/60 bg-white/45 shadow-[0_10px_30px_-14px_rgba(42,36,32,0.25),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl">
          <div
            ref={scrollRef}
            onScroll={updateFade}
            className="edge-fade-x snap-x snap-proximity relative flex overflow-x-auto no-scrollbar rounded-full p-1.5"
            style={{
              ['--fade-l' as string]: fade.left ? '26px' : '0px',
              ['--fade-r' as string]: fade.right ? '26px' : '0px',
            }}
          >
            <span
              aria-hidden="true"
              className="absolute left-0 top-1.5 bottom-1.5 rounded-full violet-grad shadow-[0_2px_10px_rgba(110,74,158,0.4)]"
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
                  'tap-sm relative z-10 flex-none sm:flex-1 min-w-fit h-12 sm:h-11 snap-start rounded-full px-4 sm:px-3 text-t14 font-medium transition-colors duration-250 ease-out',
                  view === tab.id ? 'text-white' : 'text-charcoal/70 hover:text-charcoal',
                )}
              >
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
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
