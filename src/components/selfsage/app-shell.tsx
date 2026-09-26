'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon, LogoMark, type IconName } from './icons';
import { MandalaBackdrop } from './ui-primitives';
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

function useSlidingIndicator(activeIndex: number, vertical: boolean) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });

  useLayoutEffect(() => {
    const el = refs.current[activeIndex];
    if (!el) return;
    if (vertical) {
      setStyle({ transform: `translateY(${el.offsetTop}px)`, height: el.offsetHeight, opacity: 1 });
    } else {
      setStyle({ transform: `translateX(${el.offsetLeft}px)`, width: el.offsetWidth, opacity: 1 });
    }
  }, [activeIndex, vertical]);

  const bind = (i: number) => (el: HTMLButtonElement | null) => {
    refs.current[i] = el;
  };

  return { bind, style };
}

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
  const { bind, style } = useSlidingIndicator(activeIndex, !!vertical);

  return (
    <>
      <span
        className="absolute rounded-full gold-grad shadow-[0_2px_12px_rgba(201,162,39,0.45)]"
        style={{
          ...style,
          transition: 'transform 250ms ease, width 250ms ease, height 250ms ease',
          ...(vertical ? { left: 10, right: 10 } : { top: 6, bottom: 6 }),
        }}
      />
      {TABS.map((t, i) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            ref={bind(i)}
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
    </>
  );
}

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

  return (
    <div className="min-h-screen flex flex-col bg-cream text-charcoal">
      <MandalaBackdrop />

      {/* Desktop sidebar (≥1024px) */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[92px] z-40 flex-col items-center py-5">
        <div className="glass w-[76px] flex-1 flex flex-col items-center py-5 rounded-3xl">
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
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 lg:pl-[120px] pt-4 sm:pt-6 pb-28 lg:pb-10">
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
          'lg:hidden fixed z-40 bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 glass rounded-full h-16 px-2 flex items-center shadow-[0_12px_40px_rgba(42,36,32,0.18)]',
          'transition-all duration-300 ease-out will-change-transform',
          hidden ? 'translate-y-[160%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100 focus-within:pointer-events-auto focus-within:translate-y-0 focus-within:opacity-100',
        )}
      >
        <NavItems active={activeTab} onChange={onTabChange} labelOf={labelOf} />
      </nav>
    </div>
  );
}
