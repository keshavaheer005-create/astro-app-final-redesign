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
  exalted: 'emerald-grad border-emerald-deep/60 text-white font-semibold',
  own: 'bg-emerald-soft border-emerald/45 text-emerald-deep font-semibold',
  friendly: 'bg-gold-faint/70 border-gold/25 text-charcoal/80',
  neutral: 'bg-white/50 border-charcoal/10 text-charcoal/60',
  enemy: 'bg-burgundy/8 border-burgundy/25 text-burgundy',
  debilitated: 'bg-burgundy/12 border-burgundy/40 text-burgundy font-semibold',
};

export function DignityChip({ dignity, className }: { dignity: Dignity; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      title={t('reports.dignityHint')}
      className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-t12 whitespace-nowrap align-middle', DIGNITY_STYLE[dignity], className)}
    >
      {t(`reports.dignity.${dignity}`)}
    </span>
  );
}

/* ── Cards ──────────────────────────────────────────────────────────────── */

export function GlassCard({
  className,
  ink,
  children,
  onClick,
  id,
}: {
  className?: string;
  ink?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  id?: string;
}) {
  return (
    <div
      id={id}
      onClick={onClick}
      className={cn(
        ink ? 'glass-ink' : 'glass',
        // Clickable cards get Android-style press feedback (scale-in on touch)
        onClick && 'cursor-pointer tap transition-transform duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.98]',
        className,
      )}
    >
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
            <Icon name={icon} size={18} />
          </span>
        )}
        <h2 className="font-serif text-t20 font-semibold text-charcoal truncate">{title}</h2>
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
        'shadow-[0_4px_16px_rgba(201,162,39,0.35)] transition-all duration-250 ease-out',
        'hover:-translate-y-px hover:shadow-[0_6px_22px_rgba(201,162,39,0.45)] active:scale-[0.98]',
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
        'border border-gold/30 bg-white/40 transition-all duration-250 ease-out',
        'hover:border-gold/60 hover:bg-white/70 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none',
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
          ? 'gold-grad text-charcoal shadow-[0_2px_10px_rgba(201,162,39,0.35)]'
          : 'border border-gold/30 bg-white/45 text-muted-foreground hover:border-gold/55 hover:text-charcoal',
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Labelled segmented control — pill container with gold active segment.
 * Keeps option rows from wrapping into loose chips (chart style / zodiac).
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
  return (
    <div className={className}>
      <p className="text-t12 uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">{label}</p>
      <div className="inline-flex w-full rounded-full bg-gold-faint/60 border border-gold/25 p-1 gap-1" role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const isActive = o.id === active;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(o.id)}
              className={cn(
                'flex-1 min-w-0 min-h-[36px] px-2 sm:px-3 rounded-full text-t12 sm:text-t14 font-medium leading-tight',
                'whitespace-normal sm:whitespace-nowrap transition-all duration-250 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60',
                isActive
                  ? 'gold-grad text-charcoal shadow-[0_2px_10px_-4px_rgba(201,162,39,0.6)]'
                  : 'text-charcoal/70 hover:bg-white/60 hover:text-charcoal active:scale-[0.97]',
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
      <div className="rounded-full bg-white/55 border border-gold/25 p-1 backdrop-blur-md shadow-[0_8px_24px_-12px_rgba(42,36,32,0.2),inset_0_1px_0_rgba(255,255,255,0.8)]">
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
            className="absolute left-0 top-0 bottom-0 rounded-full gold-grad shadow-[0_2px_10px_rgba(201,162,39,0.4)]"
            style={{
              transform: `translateX(${pill.left}px)`,
              width: pill.width,
              opacity: pill.ready ? 1 : 0,
              transition: 'transform 250ms ease, width 250ms ease',
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

