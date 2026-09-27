'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/* ── Chakra line-art (thin 1.5px strokes, inherits currentColor) ────────── */
/* Pure inline SVG; all motion comes from the transform-only chakra-* CSS
   classes in globals.css (reduced-motion aware via the global opt-out).     */

export type ChakraSpeed = 'slow' | 'mid' | 'fast';

const SPEED_CLASS: Record<ChakraSpeed, string> = {
  slow: 'chakra-spin', // 120s
  mid: 'chakra-spin-mid', // 80s reverse
  fast: 'chakra-spin-fast', // 26s
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

// 12 radial spokes — one per rashi (precomputed & rounded for SSR hydration)
const SPOKES: [number, number, number, number][] = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  return [
    r3(50 + Math.cos(a) * 33),
    r3(50 + Math.sin(a) * 33),
    r3(50 + Math.cos(a) * 43.5),
    r3(50 + Math.sin(a) * 43.5),
  ];
});

// 72 fine tick marks between the two outer rings
const TICKS: [number, number, number, number][] = Array.from({ length: 72 }, (_, i) => {
  const a = (i * Math.PI) / 36;
  return [
    r3(50 + Math.cos(a) * 45.5),
    r3(50 + Math.sin(a) * 45.5),
    r3(50 + Math.cos(a) * 48),
    r3(50 + Math.sin(a) * 48),
  ];
});

// one lotus petal drawn once (r≈33 tip → r≈12 base), rotated ×12
const PETAL = 'M50 17 C56 24 56 33 50 38 C44 33 44 24 50 17 Z';

export function ChakraWheel({
  size = 240,
  className,
  speed = 'slow',
  strokeWidth = 1.5,
}: {
  size?: number | string;
  className?: string;
  speed?: ChakraSpeed;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(SPEED_CLASS[speed], className)}
      aria-hidden="true"
      focusable="false"
    >
      {/* outer double ring */}
      <circle cx="50" cy="50" r="48.5" />
      <circle cx="50" cy="50" r="45.5" />
      {/* fine tick marks */}
      <g opacity="0.6">
        {TICKS.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {/* 12 rashi spokes */}
      <g>
        {SPOKES.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {/* inner lotus / petal ring */}
      <g opacity="0.9">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={PETAL} transform={`rotate(${i * 30} 50 50)`} />
        ))}
      </g>
      {/* hub + center dot (zero-length round cap, matches icons.tsx dots) */}
      <circle cx="50" cy="50" r="8" />
      <path d="M50 50h0" strokeWidth={strokeWidth * 2} />
    </svg>
  );
}

/**
 * Global fixed full-viewport decoration for the app root: one large gold wheel
 * drifting top-right, one smaller counter-rotating violet wheel bottom-left.
 * Sits above the page background / .mandala-bg (z-0) and behind content —
 * never intercepts clicks, never causes overflow.
 */
export function ChakraBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-[14vmin] -right-[16vmin] text-gold opacity-[0.06]">
        <div className="chakra-breathe">
          <ChakraWheel size="70vmin" speed="slow" strokeWidth={1.5} />
        </div>
      </div>
      <div className="absolute -bottom-[10vmin] -left-[14vmin] text-violet/10">
        <ChakraWheel size="45vmin" speed="mid" strokeWidth={1.5} />
      </div>
    </div>
  );
}

/** Loading affordance: center dot + one fast-spinning chakra ring + label. */
export function ChakraSpinner({ size = 44, label }: { size?: number; label?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-2.5 text-gold">
      <div className="relative" style={{ width: size, height: size }}>
        <ChakraWheel size={size} speed="fast" strokeWidth={1.5} className="absolute inset-0" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full gold-grad" />
      </div>
      <span className="text-t12 text-muted-foreground">{label ?? t('common.loading')}</span>
    </div>
  );
}
