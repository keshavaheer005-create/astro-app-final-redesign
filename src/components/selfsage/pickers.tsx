'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Icon } from './icons';
import { cn } from '@/lib/utils';

/* ── Wheel picker (scroll-snap spinner) ─────────────────────────────────── */

const ITEM_H = 40;

export function WheelPicker({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const index = Math.max(0, items.indexOf(value));

  const scrollToIndex = useCallback(
    (i: number, smooth = true) => {
      const el = listRef.current;
      if (el) el.scrollTo({ top: i * ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
    },
    [],
  );

  useEffect(() => {
    // position without animation on mount / external value set
    const el = listRef.current;
    if (el && Math.abs(el.scrollTop - index * ITEM_H) > 2) {
      scrollToIndex(index, false);
    }
     
  }, []);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = listRef.current;
      if (!el) return;
      const i = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      if (items[clamped] !== value) onChange(items[clamped]);
    });
  }, [items, onChange, value]);

  return (
    <div className={cn('relative h-40 w-16', className)}>
      <div
        ref={listRef}
        role="listbox"
        aria-label={ariaLabel}
        tabIndex={0}
        onScroll={onScroll}
        className="wheel-mask scroll-slim h-full overflow-y-auto snap-y snap-mandatory overscroll-contain"
        style={{ scrollbarWidth: 'none' }}
      >
        <div style={{ height: 60 }} />
        {items.map((item, i) => (
          <button
            key={`${item}-${i}`}
            type="button"
            role="option"
            aria-selected={item === value}
            onClick={() => scrollToIndex(i)}
            className={cn(
              'w-full flex items-center justify-center text-center select-none transition-all duration-200 ease-out',
              item === value
                ? 'text-charcoal font-semibold text-t16'
                : 'text-muted-foreground/60 text-t14 hover:text-muted-foreground',
            )}
            style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
          >
            {item}
          </button>
        ))}
        <div style={{ height: 60 }} />
      </div>
      {/* center indicator */}
      <div className="pointer-events-none absolute left-1 right-1 top-1/2 -translate-y-1/2 h-10 rounded-xl border border-gold/45 bg-gold-soft/45" />
    </div>
  );
}

/* ── Time wheel: HH:MM (24h) via hour/min/ampm wheels ───────────────────── */

export function TimeWheel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hh, mm] = value.split(':').map(Number);
  const hour12 = ((hh + 11) % 12) + 1;
  const ampm = hh >= 12 ? 'PM' : 'AM';

  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1)), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')), []);

  const commit = (h12: number, m: number, ap: string) => {
    const h24 = ap === 'PM' ? (h12 % 12) + 12 : h12 % 12;
    onChange(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <WheelPicker ariaLabel="Hour" items={hours} value={String(hour12)} onChange={(v) => commit(Number(v), mm, ampm)} />
      <WheelPicker ariaLabel="Minute" items={minutes} value={String(mm).padStart(2, '0')} onChange={(v) => commit(hour12, Number(v), ampm)} />
      <WheelPicker ariaLabel="AM or PM" items={['AM', 'PM']} value={ampm} onChange={(v) => commit(hour12, mm, v)} className="w-20" />
    </div>
  );
}

/* ── Shared date helpers (CalendarPicker + GlassDatePicker) ─────────────── */

const pad2 = (n: number) => String(n).padStart(2, '0');
const toISO = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const monthCells = (y: number, m: number): (number | null)[] => {
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
};

/* ── Animated calendar picker ───────────────────────────────────────────── */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function CalendarPicker({
  value,
  onChange,
}: {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
}) {
  const [y, m] = value.split('-').map(Number);
  const [view, setView] = useState({ y, m });
  const [dir, setDir] = useState(1);

  // Reset the visible month when the value prop changes externally.
  // Render-time reset — the React-recommended alternative to a
  // setState-inside-effect sync (react-hooks/set-state-in-effect).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setView({ y, m });
  }

  const move = (delta: number) => {
    setDir(delta);
    setView((v) => {
      const nm = v.m + delta;
      if (nm < 1) return { y: v.y - 1, m: 12 };
      if (nm > 12) return { y: v.y + 1, m: 1 };
      return { ...v, m: nm };
    });
  };

  const cells = monthCells(view.y, view.m);
  const todayStr = todayISO();

  const pick = (day: number) => {
    onChange(toISO(view.y, view.m, day));
  };

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => move(-1)}
          className="w-9 h-9 rounded-full inline-flex items-center justify-center text-gold hover:bg-gold-soft active:scale-95 transition-all duration-200"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <div className="text-center">
          <div className="font-serif text-t16 font-semibold text-charcoal">
            {MONTHS[view.m - 1]} <span className="text-gold">{view.y}</span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => move(1)}
          className="w-9 h-9 rounded-full inline-flex items-center justify-center text-gold hover:bg-gold-soft active:scale-95 transition-all duration-200"
        >
          <Icon name="chevron-right" size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 mb-1">
        {DOW.map((d) => (
          <div key={d} className="text-center text-t12 text-muted-foreground/70 font-medium py-1">{d}</div>
        ))}
      </div>
      <div key={`${view.y}-${view.m}-${dir}`} className="grid grid-cols-7 gap-y-1" style={{ animation: `month-in 0.28s ease-out ${dir < 0 ? 'reverse' : 'normal'} both` }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`x${i}`} />;
          const dateStr = `${view.y}-${String(view.m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const selected = dateStr === value;
          const isToday = dateStr === todayStr;
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => pick(day)}
              className={cn(
                'mx-auto w-9 h-9 rounded-full inline-flex items-center justify-center text-t14 transition-all duration-200 ease-out active:scale-90',
                selected
                  ? 'gold-grad text-charcoal font-bold shadow-[0_2px_10px_rgba(201,162,39,0.45)]'
                  : 'text-charcoal/80 hover:bg-gold-soft',
                isToday && !selected && 'ring-1 ring-gold/60',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Cascading glass date picker: Year → Month → Day ────────────────────── */
/* Built for birth dates: picking 1955 must not mean tapping arrows for
   minutes. Stage 1 is a scrolling year list with sticky decade headers and a
   decade fast-jump rail, stage 2 a month grid, stage 3 a compact day grid.
   Overlay renders through a portal so glass/transform ancestors can never
   distort the fixed mobile bottom-sheet positioning.                        */

type DateStage = 'year' | 'month' | 'day';

export function GlassDatePicker({
  value,
  onChange,
  minYear = 1900,
  maxYear = new Date().getFullYear(),
  ariaLabel,
}: {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  minYear?: number;
  maxYear?: number;
  ariaLabel?: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<DateStage>('year');
  const [pos, setPos] = useState<{ left: number; top: number; triggerTop: number; width: number } | null>(null);

  const [selY, setSelY] = useState(() => Math.min(maxYear, Math.max(minYear, new Date().getFullYear() - 25)));
  const [selM, setSelM] = useState(1);
  const [activeY, setActiveY] = useState(selY);
  const [activeM, setActiveM] = useState(0);
  const [activeD, setActiveD] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<{ left: number; top: number; triggerTop: number; width: number } | null>(null);
  const yearListRef = useRef<HTMLDivElement>(null);
  const monthGridRef = useRef<HTMLDivElement>(null);
  const dayGridRef = useRef<HTMLDivElement>(null);
  const yearBtnRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const decadeHeadRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const monthBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dayBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [vy, vm, vd] = value.split('-').map(Number);
  const valid = Number.isInteger(vy) && Number.isInteger(vm) && Number.isInteger(vd) && vm >= 1 && vm <= 12 && vd >= 1 && vd <= 31;
  const daysInSel = new Date(Date.UTC(selY, selM, 0)).getUTCDate();

  const years = useMemo(
    () => Array.from({ length: Math.max(0, maxYear - minYear + 1) }, (_, i) => maxYear - i),
    [minYear, maxYear],
  );

  // newest-first decade groups: { decade: 1960, years: [1969 … 1960] }
  const decades = useMemo(() => {
    const groups: { decade: number; years: number[] }[] = [];
    for (const y of years) {
      const d = Math.floor(y / 10) * 10;
      const g = groups[groups.length - 1];
      if (g && g.decade === d) g.years.push(y);
      else groups.push({ decade: d, years: [y] });
    }
    return groups;
  }, [years]);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // body scroll lock while the overlay is up
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Escape closes (document-level, panel-level Tab trap handled separately)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const setPosBoth = (p: { left: number; top: number; triggerTop: number; width: number } | null) => {
    posRef.current = p;
    setPos(p);
  };

  const openPanel = useCallback(() => {
    const [y, m] = value.split('-').map(Number);
    const cur = new Date().getFullYear();
    const initY = Number.isInteger(y) ? Math.min(maxYear, Math.max(minYear, y)) : Math.min(maxYear, Math.max(minYear, cur - 25));
    const initM = Number.isInteger(m) && m >= 1 && m <= 12 ? m : 1;
    setSelY(initY);
    setSelM(initM);
    setActiveY(initY);
    setActiveM(initM - 1);
    setActiveD(Number.isInteger(y) && Number.isInteger(m) && initM === m && initY === y && Number.isInteger(vd) ? vd - 1 : 0);
    setStage('year');
    const r = triggerRef.current?.getBoundingClientRect();
    const width = Math.min(window.innerWidth * 0.92, 380);
    const left = r ? Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) : 8;
    const top = r ? Math.min(r.bottom + 8, window.innerHeight - 120) : 96;
    setPosBoth({ left, top, triggerTop: r?.top ?? 64, width });
    setOpen(true);
  }, [value, minYear, maxYear, vd]);

  // desktop popover flip + per-stage auto-center / initial focus
  useLayoutEffect(() => {
    if (!open) return;
    const p = posRef.current;
    if (isDesktop && p && panelRef.current) {
      const h = panelRef.current.offsetHeight;
      if (p.top + h > window.innerHeight - 8) {
        const top = Math.max(8, p.triggerTop - h - 8);
        if (top !== p.top) setPosBoth({ ...p, top });
      }
    }
    if (stage === 'year') {
      const list = yearListRef.current;
      const btn = yearBtnRefs.current[selY];
      if (list && btn) list.scrollTop = btn.offsetTop - list.clientHeight / 2 + btn.clientHeight / 2;
      list?.focus();
    } else if (stage === 'month') {
      monthGridRef.current?.focus();
    } else {
      dayGridRef.current?.focus();
    }
  }, [open, stage, isDesktop, selY]);

  // focus trap (Tab cycles inside the dialog)
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const root = panelRef.current;
    if (!root) return;
    const els = Array.from(
      root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'),
    );
    if (!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    const activeEl = document.activeElement;
    if (e.shiftKey && (activeEl === first || activeEl === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && activeEl === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onYearListKeys = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const idx = years.indexOf(activeY);
    const next = Math.max(0, Math.min(years.length - 1, (idx < 0 ? 0 : idx) + (e.key === 'ArrowDown' ? 1 : -1)));
    const y = years[next];
    setActiveY(y);
    const el = yearBtnRefs.current[y];
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'nearest' });
    }
  };

  const onMonthGridKeys = (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === 'ArrowRight') delta = 1;
    else if (e.key === 'ArrowLeft') delta = -1;
    else if (e.key === 'ArrowDown') delta = 3;
    else if (e.key === 'ArrowUp') delta = -3;
    else return;
    e.preventDefault();
    const next = Math.max(0, Math.min(11, activeM + delta));
    setActiveM(next);
    monthBtnRefs.current[next]?.focus();
  };

  const onDayGridKeys = (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === 'ArrowRight') delta = 1;
    else if (e.key === 'ArrowLeft') delta = -1;
    else if (e.key === 'ArrowDown') delta = 7;
    else if (e.key === 'ArrowUp') delta = -7;
    else return;
    e.preventDefault();
    const next = Math.max(0, Math.min(daysInSel - 1, activeD + delta));
    setActiveD(next);
    dayBtnRefs.current[next]?.focus();
  };

  const displayDate = (() => {
    if (!valid) return value;
    try {
      return new Date(Date.UTC(vy, vm - 1, vd)).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      return value;
    }
  })();

  const stages: { id: DateStage; label: string }[] = [
    { id: 'year', label: t('date.year') },
    { id: 'month', label: t('date.month') },
    { id: 'day', label: t('date.day') },
  ];
  const stageIdx = stage === 'year' ? 0 : stage === 'month' ? 1 : 2;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ?? t('date.a11y.open')}
        className={cn(
          'w-full h-11 rounded-xl border border-gold/30 bg-white/70 px-4 flex items-center gap-2.5 text-left',
          'transition-all duration-250 focus:border-gold/60 focus:ring-2 focus:ring-gold/25',
        )}
      >
        <Icon name="calendar" size={18} className="text-gold shrink-0" />
        <span className={cn('flex-1 truncate text-t14', valid ? 'text-charcoal' : 'text-muted-foreground/60')}>{displayDate}</span>
        <Icon name="chevron-down" size={16} className="text-gold/70 shrink-0" />
      </button>

      {mounted &&
        createPortal(
          <>
            <AnimatePresence>
              {open && (
                <motion.div
                  key="gdp-backdrop"
                  className="fixed inset-0 z-40 bg-ink/25 sm:bg-ink/10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  onClick={close}
                  aria-hidden="true"
                />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {open && (
                <motion.div
                  key="gdp-panel"
                  ref={panelRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label={ariaLabel ?? t('date.title')}
                  initial={{ opacity: 0, scale: 0.96, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 10 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  onKeyDown={trapTab}
                  style={
                    isDesktop && pos
                      ? { left: pos.left, top: pos.top, width: pos.width }
                      : { paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }
                  }
                  className={cn(
                    'glass fixed z-50 flex flex-col',
                    'inset-x-0 bottom-0 max-h-[70vh] rounded-t-3xl',
                    isDesktop && 'inset-x-auto bottom-auto rounded-3xl max-h-[min(70vh,460px)]',
                  )}
                >
                  {/* header: title + breadcrumb + close */}
                  <div className="px-4 pt-3.5 pb-2 shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-t12 uppercase tracking-wide font-semibold text-muted-foreground/80 truncate">
                        {t('date.title')}
                      </p>
                      <button
                        type="button"
                        onClick={close}
                        aria-label={t('date.close')}
                        className="w-8 h-8 -mr-1 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-charcoal hover:bg-gold-soft transition-colors duration-150"
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                    <div className="mt-1 flex items-center gap-0.5 text-t14">
                      {stages.map((s, i) => {
                        const current = i === stageIdx;
                        const done = i < stageIdx;
                        return (
                          <React.Fragment key={s.id}>
                            {i > 0 && <Icon name="chevron-right" size={13} className="text-gold/60 shrink-0" />}
                            {done ? (
                              <button
                                type="button"
                                onClick={() => setStage(s.id)}
                                className="px-1 text-charcoal/55 hover:text-gold transition-colors duration-150"
                              >
                                {s.label}
                              </button>
                            ) : (
                              <span className={cn('px-1', current ? 'text-gold font-semibold' : 'text-muted-foreground/40')}>
                                {s.label}
                              </span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* stage: year list with sticky decade headers + fast-jump rail */}
                  {stage === 'year' && (
                    <div className="flex gap-1 px-3 pb-3 flex-1 min-h-0">
                      <div
                        ref={yearListRef}
                        role="listbox"
                        aria-label={t('date.year')}
                        tabIndex={0}
                        onKeyDown={onYearListKeys}
                        className="relative flex-1 min-w-0 overflow-y-auto scroll-slim overscroll-contain"
                      >
                        {decades.map((g) => (
                          <div key={g.decade}>
                            <div
                              ref={(el) => {
                                decadeHeadRefs.current[g.decade] = el;
                              }}
                              className="sticky top-0 z-10 bg-white/85 text-t12 font-semibold text-gold px-2 py-1.5"
                            >
                              {`${g.decade}${t('date.decadeSuffix')}`}
                            </div>
                            {g.years.map((y) => {
                              const selected = y === selY;
                              return (
                                <button
                                  key={y}
                                  ref={(el) => {
                                    yearBtnRefs.current[y] = el;
                                  }}
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  onFocus={() => setActiveY(y)}
                                  onClick={() => {
                                    setSelY(y);
                                    setStage('month');
                                  }}
                                  className={cn(
                                    'w-full h-10 px-2.5 rounded-lg text-left text-t14 transition-colors duration-150',
                                    selected ? 'bg-gold-soft text-gold font-semibold' : 'text-charcoal/80 hover:bg-gold-faint',
                                  )}
                                >
                                  {y}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col shrink-0 py-1" aria-hidden="true">
                        {decades.map((g) => (
                          <button
                            key={g.decade}
                            type="button"
                            tabIndex={-1}
                            onClick={() => {
                              const head = decadeHeadRefs.current[g.decade];
                              const list = yearListRef.current;
                              if (head && list) list.scrollTop = head.offsetTop - 2;
                            }}
                            className="w-8 h-6 rounded text-[10px] leading-none text-muted-foreground/60 hover:text-gold hover:bg-gold-faint transition-colors duration-150"
                          >
                            {String(g.decade).slice(2)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* stage: month grid */}
                  {stage === 'month' && (
                    <div
                      ref={monthGridRef}
                      role="listbox"
                      aria-label={t('date.month')}
                      tabIndex={0}
                      onKeyDown={onMonthGridKeys}
                      className="grid grid-cols-3 gap-1.5 px-4 pb-4 outline-none"
                    >
                      {Array.from({ length: 12 }, (_, i) => {
                        const selected = selM === i + 1;
                        return (
                          <button
                            key={i}
                            ref={(el) => {
                              monthBtnRefs.current[i] = el;
                            }}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onFocus={() => setActiveM(i)}
                            onClick={() => {
                              setSelM(i + 1);
                              setActiveD(valid && vy === selY && vm === i + 1 && vd >= 1 ? vd - 1 : 0);
                              setStage('day');
                            }}
                            className={cn(
                              'h-11 rounded-xl px-1 text-t14 truncate transition-all duration-150',
                              selected
                                ? 'gold-grad text-charcoal font-semibold shadow-[0_2px_10px_rgba(201,162,39,0.35)]'
                                : 'text-charcoal/80 hover:bg-gold-faint',
                            )}
                          >
                            {t(`date.months.${i}`)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* stage: compact day grid for the chosen year + month */}
                  {stage === 'day' && (
                    <div className="px-4 pb-4">
                      <div className="text-center font-serif text-t16 font-semibold text-charcoal mb-2">
                        {t(`date.months.${selM - 1}`)} <span className="text-gold">{selY}</span>
                      </div>
                      <div ref={dayGridRef} tabIndex={0} onKeyDown={onDayGridKeys} className="outline-none">
                        <div className="grid grid-cols-7 gap-y-1 mb-1">
                          {Array.from({ length: 7 }, (_, i) => (
                            <div key={i} className="text-center text-t12 text-muted-foreground/70 font-medium py-1">
                              {t(`weekdaysShort.${i}`)}
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-y-1">
                          {monthCells(selY, selM).map((day, i) => {
                            if (day === null) return <div key={`x${i}`} />;
                            const dateStr = toISO(selY, selM, day);
                            const selected = dateStr === value;
                            const isToday = dateStr === todayISO();
                            const dayIdx = day - 1;
                            return (
                              <button
                                key={dateStr}
                                ref={(el) => {
                                  dayBtnRefs.current[dayIdx] = el;
                                }}
                                type="button"
                                aria-label={`${dateStr}${isToday ? ` · ${t('date.today')}` : ''}`}
                                onFocus={() => setActiveD(dayIdx)}
                                onClick={() => {
                                  onChange(dateStr);
                                  close();
                                }}
                                className={cn(
                                  'mx-auto w-9 h-9 rounded-full inline-flex items-center justify-center text-t14 transition-all duration-200 ease-out active:scale-90',
                                  selected
                                    ? 'gold-grad text-charcoal font-bold shadow-[0_2px_10px_rgba(201,162,39,0.45)]'
                                    : 'text-charcoal/80 hover:bg-gold-soft',
                                  isToday && !selected && 'ring-1 ring-gold/60',
                                )}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>,
          document.body,
        )}
    </div>
  );
}
