'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  useEffect(() => {
    setView({ y, m });
  }, [y, m]);

  const move = (delta: number) => {
    setDir(delta);
    setView((v) => {
      const nm = v.m + delta;
      if (nm < 1) return { y: v.y - 1, m: 12 };
      if (nm > 12) return { y: v.y + 1, m: 1 };
      return { ...v, m: nm };
    });
  };

  const firstDow = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const pick = (day: number) => {
    onChange(`${view.y}-${String(view.m).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
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
