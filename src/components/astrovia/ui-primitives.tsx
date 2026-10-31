'use client';

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, LogoMark, type IconName } from './icons';
import { cn } from '@/lib/utils';
import type { Dignity } from '@/lib/astro/dignity';

/* ── Sliding indicator hook (shared by nav, tabs, segmented controls) ─────
   Measures the active item and returns a transform-animated pill style so
   active states SLIDE (250ms ease) instead of popping. Consumers place the
   returned style on an absolutely-positioned span inside a relative parent. */
export function useSlidingIndicator(activeIndex: number, vertical: boolean) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[activeIndex];
      if (!el) return;
      if (vertical) {
        setStyle({ transform: `translateY(${el.offsetTop}px)`, height: el.offsetHeight, opacity: 1 });
      } else {
        setStyle({ transform: `translateX(${el.offsetLeft}px)`, width: el.offsetWidth, opacity: 1 });
      }
    };
    measure();
    // Re-measure when the viewport changes so the pill never drifts off the
    // active label on resize / orientation change (mobile-critical).
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [activeIndex, vertical]);

  const bind = (i: number) => (el: HTMLElement | null) => {
    refs.current[i] = el;
  };

  return { bind, style };
}

/* ── Dignity chips (shared by D1 planets table & D9 varga table) ─────────── */

/** Chip styling per classical dignity tier (emerald = strength, burgundy = strain). */
const DIGNITY_STYLE: Record<Dignity, string> = {
  exalted: 'liquid liquid-emerald font-semibold',
  own: 'bg-emerald-soft text-emerald-deep font-semibold',
  friendly: 'bg-gold-faint/80 text-charcoal/80',
  neutral: 'bg-white/60 text-charcoal/60',
  enemy: 'bg-burgundy-soft/80 text-burgundy',
  debilitated: 'liquid liquid-violet font-semibold',
};

export function DignityChip({ dignity, className }: { dignity: Dignity; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      title={t('reports.dignityHint')}
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-t12 whitespace-nowrap align-middle shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]', DIGNITY_STYLE[dignity], className)}
    >
      {t(`reports.dignity.${dignity}`)}
    </span>
  );
}

/* ── Cards ──────────────────────────────────────────────────────────────── */

export function GlassCard({
  className,
  ink,
  tone,
  children,
  onClick,
  id,
}: {
  className?: string;
  ink?: boolean;
  /** Tone essence — a soft radial wash of the tab's colour breathing through
      the glass (never a fill, never a border). Rendered behind content. */
  tone?: 'gold' | 'emerald' | 'violet' | 'rose' | 'burgundy';
  children: React.ReactNode;
  onClick?: () => void;
  id?: string;
}) {
  return (
    <div
      id={id}
      onClick={onClick}
      className={cn(
        'relative',
        ink ? 'glass-ink' : 'glass',
        // Clickable cards: subtle press compress only — no hover lift (ASTRA).
        onClick && 'cursor-pointer tap active:scale-[0.98]',
        className,
      )}
    >
      {tone && <span aria-hidden="true" className={cn('essence', `essence-${tone}`)} />}
      {children}
    </div>
  );
}

/* Semantic section-header tones — gold is the default; accents mark domain. */
const HEADER_TONES = {
  gold: { icon: 'text-gold', rule: 'from-gold/35' },
  rose: { icon: 'text-rose', rule: 'from-rose/35' },
  violet: { icon: 'text-violet', rule: 'from-violet/35' },
  emerald: { icon: 'text-emerald', rule: 'from-emerald/35' },
  burgundy: { icon: 'text-burgundy', rule: 'from-burgundy/35' },
} as const;

export function SectionHeader({
  title,
  icon,
  action,
  tone = 'gold',
}: {
  title: string;
  icon?: IconName;
  action?: React.ReactNode;
  tone?: keyof typeof HEADER_TONES;
}) {
  const t = HEADER_TONES[tone];
  return (
    <div className="flex items-center justify-between gap-3 mb-3 mt-1">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span className={cn(t.icon, 'inline-flex shrink-0')}>
            <Icon name={icon} size={19} />
          </span>
        )}
        <h2 className="font-serif text-t20 font-bold tracking-[-0.01em] text-charcoal truncate">{title}</h2>
      </div>
      {action}
      <div className={cn('hidden sm:block flex-1 h-px bg-gradient-to-r to-transparent', t.rule)} />
    </div>
  );
}

/* ── Buttons ────────────────────────────────────────────────────────────── */

export function GoldButton({
  children,
  onClick,
  className,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'gold-grad ripple inline-flex items-center justify-center gap-2 rounded-full px-6 h-11 text-t14 font-semibold text-charcoal',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_14px_-4px_rgba(178,134,44,0.45)] transition-all duration-200 ease-out',
        'hover:brightness-[0.98] active:scale-[0.98]',
        'disabled:opacity-45 disabled:pointer-events-none',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  className,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'tap inline-flex items-center justify-center gap-2 rounded-full px-5 h-10 text-t14 font-medium text-charcoal',
        'bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_10px_-4px_rgba(42,36,32,0.14)] backdrop-blur-sm',
        'transition-all duration-250 ease-out',
        'hover:bg-white/80 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({
  active,
  children,
  onClick,
  className,
  compact,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full text-t12 font-medium transition-all duration-250 ease-out active:scale-95 whitespace-nowrap',
        compact ? 'px-3 h-7' : 'px-4 h-8',
        active
          ? 'liquid liquid-gold'
          : 'bg-white/50 text-muted-foreground hover:bg-white/75 hover:text-charcoal',
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Labelled segmented control — pill container with a true SLIDING liquid
 * indicator. The active glass pill is ONE absolutely-positioned element that
 * transforms between measured offsets (300ms Apple ease), so switching never
 * pops, flickers or jumps height (the old class-swap pill did both).
 * Fixed row height + nowrap labels keep the track perfectly stable.
 */
export function Segmented({
  label,
  options,
  active,
  onChange,
  className,
}: {
  label: string;
  options: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const activeIndex = Math.max(0, options.findIndex((o) => o.id === active));
  const { bind, style } = useSlidingIndicator(activeIndex, false);

  return (
    <div className={className}>
      <p className="text-t12 tracking-wide font-semibold text-muted-foreground mb-1.5">{label}</p>
      <div
        className="relative inline-flex w-full rounded-full bg-white/50 border border-white/60 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm"
        role="radiogroup"
        aria-label={label}
      >
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 left-0 rounded-full liquid liquid-gold"
          style={{ width: style.width, transform: style.transform, opacity: style.opacity, left: 0 }}
        />
        {options.map((o, i) => {
          const isActive = o.id === active;
          return (
            <button
              key={o.id}
              ref={bind(i)}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(o.id)}
              className={cn(
                'relative z-10 flex-1 min-w-0 h-9 px-1.5 sm:px-3 rounded-full whitespace-nowrap text-center',
                'text-[11.5px] sm:text-t14 leading-none tracking-tight transition-colors duration-250 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60',
                isActive ? 'font-semibold text-charcoal' : 'font-medium text-charcoal/70 hover:text-charcoal active:scale-[0.97]',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StatPill({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3 min-w-0">
      <span className="text-gold shrink-0"><Icon name={icon} size={20} /></span>
      <div className="min-w-0">
        <div className="text-t12 text-muted-foreground truncate">{label}</div>
        <div className="text-t14 font-semibold text-charcoal truncate">{value}</div>
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  className,
  tone = 'gold',
}: {
  value: number;
  className?: string;
  tone?: 'gold' | 'rose' | 'emerald' | 'violet';
}) {
  const track = tone === 'rose' ? 'bg-rose/15' : tone === 'emerald' ? 'bg-emerald/15' : tone === 'violet' ? 'bg-violet/15' : 'bg-gold/15';
  const fill = tone === 'rose' ? 'rose-grad' : tone === 'emerald' ? 'emerald-grad' : tone === 'violet' ? 'violet-grad' : 'gold-grad';
  return (
    <div className={cn('h-1.5 rounded-full overflow-hidden', track, className)}>
      <div
        className={cn('h-full rounded-full transition-[width,transform] duration-300 ease-out', fill)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ── Sliding pill tabs ──────────────────────────────────────────────────── */

export function SlidingPillTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
  compact,
}: {
  tabs: { id: T; label: string; icon?: IconName }[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  compact?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });
  const [fade, setFade] = useState({ left: false, right: false });

  // Edge fades appear only while the strip actually overflows — signals that
  // more tabs are reachable by swiping (mobile) without truncating labels.
  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setFade({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useLayoutEffect(() => {
    const idx = tabs.findIndex((t) => t.id === active);
    const el = refs.current[idx];
    if (el) {
      setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
      // Keep the active tab visible inside the scrollable strip (never pans the page:
      // the strip is its own horizontal scroll container and the page clips overflow-x).
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
    updateFade();
  }, [active, tabs, updateFade]);

  return (
    <div className={cn('relative', className)}>
      {/* Glass shell stays static; the transparent track scrolls and gets the
          background-agnostic mask fade (never a hard colour-matched gradient). */}
      <div className="rounded-full bg-white/50 border border-white/60 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_12px_-4px_rgba(42,36,32,0.12)] backdrop-blur-sm">
        <div
          ref={scrollRef}
          onScroll={updateFade}
          className="edge-fade-x relative flex overflow-x-auto no-scrollbar rounded-full p-0"
          style={{
            ['--fade-l' as string]: fade.left ? '24px' : '0px',
            ['--fade-r' as string]: fade.right ? '24px' : '0px',
          }}
        >
          <span
            className="absolute left-0 top-0 bottom-0 rounded-full liquid liquid-gold"
            style={{
              transform: `translateX(${pill.left}px)`,
              width: pill.width,
              opacity: pill.ready ? 1 : 0,
              transition: 'transform 300ms cubic-bezier(0.32,0.72,0,1), width 300ms cubic-bezier(0.32,0.72,0,1)',
            }}
          />
          {tabs.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              onClick={() => onChange(t.id)}
              className={cn(
                'relative z-10 flex-none sm:flex-1 min-w-fit flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors duration-250 ease-out active:scale-[0.97]',
                compact ? 'h-9 px-3 text-t12' : 'h-10 px-3.5 text-t14',
                active === t.id ? 'text-charcoal' : 'text-muted-foreground hover:text-charcoal',
              )}
            >
              {t.icon && <Icon name={t.icon} size={compact ? 14 : 16} />}
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── States ─────────────────────────────────────────────────────────────── */

export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 animate-fade-in">
      <div className="relative">
        <LogoMark size={52} className="animate-pulse" />
        <span className="absolute inset-0 rounded-full border border-gold/40 animate-[pulse-ring_1.6s_ease-out_infinite]" />
      </div>
      {label && <p className="text-t14 text-muted-foreground">{label}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center animate-fade-in">
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-burgundy-soft text-burgundy">
        <Icon name="warning" size={22} />
      </span>
      <p className="text-t14 text-charcoal font-medium">{message ?? 'Something went wrong'}</p>
      {onRetry && (
        <GhostButton onClick={onRetry}>
          <Icon name="refresh" size={16} /> Try again
        </GhostButton>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center animate-fade-in">
      <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold-soft text-gold">
        <Icon name={icon} size={26} />
      </span>
      <p className="font-serif text-t20 text-charcoal">{title}</p>
      {body && <p className="text-t14 text-muted-foreground max-w-sm">{body}</p>}
    </div>
  );
}

