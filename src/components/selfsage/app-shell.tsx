'use client';

import React, { useEffect, useState } from 'react';
import { Icon, LogoMark, type IconName } from './icons';
import { MandalaBackdrop } from './ui-primitives';
import { ChakraBackdrop, ScreenGradient } from './chakra';
import { useAppStore, type ScreenTone } from '@/store/app';
import { cn } from '@/lib/utils';

export type TabId = 'home' | 'kundli' | 'journal' | 'acharya' | 'profile';

/**
 * Immersive scroll behaviour for the floating pill nav: slides out of the way
 * while scrolling down, returns the moment you scroll up (or near the top).
 * Only transform/opacity are animated; keyboard focus forces it visible.
 */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        if (y > 140 && dy > 6) setHidden(true);
        else if (dy < -6 || y <= 140) setHidden(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return hidden;
}

export const TABS: { id: TabId; icon: IconName; labelKey: string }[] = [
  { id: 'home', icon: 'home', labelKey: 'tab.home' },
  { id: 'kundli', icon: 'chart', labelKey: 'tab.kundli' },
  { id: 'journal', icon: 'journal', labelKey: 'tab.journal' },
  { id: 'acharya', icon: 'chat', labelKey: 'tab.acharya' },
  { id: 'profile', icon: 'user', labelKey: 'tab.profile' },
];

function NavItems({
  active,
  onChange,
  vertical,
  labelOf,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  vertical?: boolean;
  labelOf: (key: string) => string;
}) {
  const activeIndex = TABS.findIndex((t) => t.id === active);

  /* Deterministic indicator — no JS measurement, so the gold pill lands
     dead-centre under the active tab at EVERY viewport width (measured
     offsets went stale on resize, especially on mobile). Horizontal items
     are equal flex-1 columns (20% each); vertical items are a fixed
     58px + 8px-gap rhythm. */
  return (
    <div className={cn('relative flex w-full', vertical ? 'flex-col gap-2' : 'flex-row h-full')}>
      <span
        aria-hidden="true"
        className="absolute rounded-full gold-grad shadow-[0_2px_12px_rgba(201,162,39,0.45)] transition-all duration-300 ease-out"
        style={
          vertical
            ? { top: 0, height: 58, left: 2, right: 2, transform: `translateY(${activeIndex * 66}px)` }
            : { left: 3, width: 'calc(20% - 6px)', top: 6, bottom: 6, transform: `translateX(calc(${activeIndex} * (100% + 6px)))` }
        }
      />
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-label={labelOf(t.labelKey)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative z-10 flex items-center rounded-full transition-colors duration-250 ease-out active:scale-95',
              vertical
                ? 'flex-col gap-1 w-full h-[58px] justify-center'
                : 'flex-1 flex-col justify-center gap-0.5 h-full',
              isActive ? 'text-charcoal' : 'text-gold hover:text-gold-light',
            )}
          >
            <Icon name={t.icon} size={vertical ? 22 : 21} />
            <span className={cn('font-medium', vertical ? 'text-t12' : 'text-[10px] leading-tight')}>
              {labelOf(t.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const TAB_TONE: Record<TabId, ScreenTone> = {
  home: 'gold',
  kundli: 'gold', // overridden per sub-view inside KundliTab
  journal: 'emerald',
  acharya: 'emerald',
  profile: 'burgundy',
};

export function AppShellInner({
  activeTab,
  onTabChange,
  labelOf,
  children,
}: {
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
  labelOf: (key: string) => string;
  children: React.ReactNode;
}) {
  const hidden = useHideOnScroll();
  const tone = useAppStore((s) => s.screenTone);
  const setScreenTone = useAppStore((s) => s.setScreenTone);

  // Each tab owns its atmosphere; KundliTab drives its own per-view tone
  // (child effect wins over this one for kundli).
  useEffect(() => {
    if (activeTab !== 'kundli') setScreenTone(TAB_TONE[activeTab]);
  }, [activeTab, setScreenTone]);

  return (
    <div className="min-h-screen flex flex-col bg-cream text-charcoal">
      <MandalaBackdrop />
      <ChakraBackdrop />
      <ScreenGradient tone={tone} />

      {/* Desktop sidebar (≥1024px) */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[92px] z-40 flex-col items-center py-5">
        <div className="glass bar-texture w-[76px] flex-1 flex flex-col items-center py-5 rounded-3xl">
          <button
            type="button"
            aria-label="Self Sage home"
            onClick={() => onTabChange('home')}
            className="mb-6 transition-transform duration-250 hover:scale-105 active:scale-95"
          >
            <LogoMark size={38} />
          </button>
          <nav aria-label="Main navigation" className="relative flex flex-col gap-2 w-full px-2">
            <NavItems active={activeTab} onChange={onTabChange} vertical labelOf={labelOf} />
          </nav>
        </div>
      </aside>

      {/* Content */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 lg:pl-[120px] pt-4 sm:pt-6 pb-28 lg:pb-10">
        <div
          key={activeTab}
          className="stagger-in"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {children}
        </div>
      </main>

      {/* Mobile floating pill nav (<1024px) — hides on scroll down, returns on scroll up */}
      <nav
        aria-label="Main navigation"
        aria-hidden={hidden}
        className={cn(
          'lg:hidden fixed z-40 bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 glass bar-texture rounded-full h-16 px-2 flex items-center shadow-[0_12px_40px_rgba(42,36,32,0.18)]',
          'transition-all duration-300 ease-out will-change-transform',
          hidden ? 'translate-y-[160%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100 focus-within:pointer-events-auto focus-within:translate-y-0 focus-within:opacity-100',
        )}
      >
        <NavItems active={activeTab} onChange={onTabChange} labelOf={labelOf} />
      </nav>
    </div>
  );
}
