'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Mandala } from './mandala';

/* ── Chakra line-art (thin strokes, inherits currentColor) ──────────────── */
/* Pure inline SVG. Everything here is STILL — no animation, no will-change,
   so the decorative layers are painted once and cost no CPU/GPU per frame.
   The only moving piece is the ChakraSpinner loader (animated opt-in).      */

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** n radial segments between radii r1→r2, as ONE path string (1 DOM node instead of n). */
const radialPath = (n: number, r1: number, r2: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n + offset;
    const c = Math.cos(a), sn = Math.sin(a);
    return `M${r3(50 + c * r1)} ${r3(50 + sn * r1)}L${r3(50 + c * r2)} ${r3(50 + sn * r2)}`;
  }).join('');

/** n tiny dots on a ring, as ONE path string (zero-length round-capped segments). */
const dotRing = (n: number, r: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n + offset;
    return `M${r3(50 + Math.cos(a) * r)} ${r3(50 + Math.sin(a) * r)}h0`;
  }).join('');

const WHEEL_TICKS = radialPath(72, 45.5, 48); // fine tick marks between the two outer rings
const WHEEL_SPOKES = radialPath(12, 33, 43.5); // 12 rashi spokes
const WHEEL_DOTS = dotRing(24, 29.5, Math.PI / 24); // bead ring between spokes and lotus

// one lotus petal drawn once (r≈33 tip → r≈12 base), rotated ×12
const PETAL = 'M50 17 C56 24 56 33 50 38 C44 33 44 24 50 17 Z';
// smaller inner petal, offset half a step → a layered, double-lotus look
const PETAL_INNER = 'M50 27 C54 31.5 54 37 50 40.5 C46 37 46 31.5 50 27 Z';

export function ChakraWheel({
  size = 240,
  className,
  strokeWidth = 1.5,
  animated = false,
}: {
  size?: number | string;
  className?: string;
  strokeWidth?: number;
  /** Only for loaders. Decorative chakras must stay still. */
  animated?: boolean;
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
      className={cn(animated && 'chakra-spin-fast', className)}
      aria-hidden="true"
      focusable="false"
    >
      {/* outer double ring */}
      <circle cx="50" cy="50" r="48.5" />
      <circle cx="50" cy="50" r="45.5" />
      {/* fine tick marks */}
      <path d={WHEEL_TICKS} opacity="0.6" />
      {/* 12 rashi spokes */}
      <path d={WHEEL_SPOKES} />
      {/* bead ring */}
      <path d={WHEEL_DOTS} strokeWidth={strokeWidth * 1.6} opacity="0.7" />
      {/* inner lotus: outer petals + offset inner petals */}
      <g opacity="0.9">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={PETAL} transform={`rotate(${i * 30} 50 50)`} />
        ))}
      </g>
      <g opacity="0.6">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={PETAL_INNER} transform={`rotate(${i * 30 + 15} 50 50)`} />
        ))}
      </g>
      {/* hub + center dot (zero-length round cap, matches icons.tsx dots) */}
      <circle cx="50" cy="50" r="8" />
      <circle cx="50" cy="50" r="4.5" opacity="0.6" />
      <path d="M50 50h0" strokeWidth={strokeWidth * 2} />
    </svg>
  );
}

/**
 * Om emblem — a refined line-art mark: an authentic ॐ glyph held inside a
 * thin double ring. Fully still. Used sparingly: Acharya's empty state,
 * onboarding.
 */
export function OmEmblem({
  size = 84,
  className,
  strokeWidth = 1.4,
}: {
  size?: number | string;
  className?: string;
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
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="50" cy="50" r="48.5" />
      <circle cx="50" cy="50" r="44.5" />
      <path d={WHEEL_TICKS} opacity="0.55" strokeWidth={strokeWidth * 0.8} />
      {/* the glyph — authentic Devanagari Om, rendered by the device font */}
      <text
        x="50"
        y="63.5"
        textAnchor="middle"
        fontSize="44"
        fill="currentColor"
        stroke="none"
        style={{ fontFamily: "'Noto Sans Devanagari', 'Nirmala UI', 'Mangal', serif" }}
      >
        ॐ
      </text>
    </svg>
  );
}

/**
 * Global fixed full-viewport decoration — premium, still mandala art:
 * one in each corner and one centred on each side edge. Sizes scale with the
 * shorter screen side (vmin) and are chosen so no two mandalas ever touch,
 * on phones or wide desktops. Behind all content, never intercepts clicks,
 * never causes scrolling, and never animates (memoised, painted once).
 */
function ChakraBackdropImpl() {
  const corner = { width: '48vmin', height: '48vmin' } as const;
  const side = { width: '36vmin', height: '36vmin' } as const;
  // ASTRA: mandalas quiet down to a paper-watermark whisper (was 0.62).
  const art = 'absolute opacity-[0.34]';
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* corners — centre sits 2vmin inside each corner */}
      <Mandala variant="lotus" className={art} style={{ ...corner, left: '-22vmin', top: '-22vmin' }} />
      <Mandala variant="lotus" className={art} style={{ ...corner, right: '-22vmin', top: '-22vmin', transform: 'rotate(7.5deg)' }} />
      <Mandala variant="lotus" className={art} style={{ ...corner, left: '-22vmin', bottom: '-22vmin', transform: 'rotate(7.5deg)' }} />
      <Mandala variant="lotus" className={art} style={{ ...corner, right: '-22vmin', bottom: '-22vmin' }} />
      {/* mid sides — centre sits on the screen edge, half hidden */}
      <Mandala variant="star" className={art} style={{ ...side, left: '-18vmin', top: '50%', marginTop: '-18vmin' }} />
      <Mandala variant="star" className={art} style={{ ...side, right: '-18vmin', top: '50%', marginTop: '-18vmin', transform: 'rotate(11.25deg)' }} />
    </div>
  );
}

export const ChakraBackdrop = React.memo(ChakraBackdropImpl);

/**
 * ScreenGradient — the app's atmosphere, liquid-glass edition.
 *
 * Every tab owns its own accent atmosphere anchored at the TOP of the
 * viewport with a faint echo pool at the bottom, so the tone visibly wraps
 * the screen without ever becoming a wall. All five tone layers stay
 * mounted and cross-fade via opacity (800ms, Apple ease) so switching tabs
 * melts one atmosphere into the next — gold · emerald · rose · burgundy —
 * instead of hard-cutting. Kept light: an essence, not a fill.
 */
const TONE_GLOW: Record<string, string> = {
  gold: 'rgba(213, 160, 69, 0.17)',
  emerald: 'rgba(46, 128, 108, 0.15)',
  violet: 'rgba(139, 41, 69, 0.15)',
  rose: 'rgba(192, 111, 121, 0.15)',
  burgundy: 'rgba(139, 41, 69, 0.15)',
};

export function ScreenGradient({ tone }: { tone: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden" aria-hidden="true">
      {(Object.keys(TONE_GLOW) as (keyof typeof TONE_GLOW)[]).map((key) => (
        <div
          key={key}
          className="absolute inset-0 transition-opacity duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            opacity: tone === key ? 1 : 0,
            background:
              `radial-gradient(120% 46% at 50% 0%, ${TONE_GLOW[key]}, transparent 68%),` +
              `radial-gradient(140% 30% at 50% 100%, ${TONE_GLOW[key].replace(/0\.\d+\)$/, '0.06)')}, transparent 70%)`,
          }}
        />
      ))}
    </div>
  );
}

/** Loading affordance: center dot + one fast-spinning chakra ring + label. */
export function ChakraSpinner({ size = 44, label }: { size?: number; label?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-2.5 text-gold">
      <div className="relative" style={{ width: size, height: size }}>
        <ChakraWheel size={size} animated strokeWidth={1.5} className="absolute inset-0" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full gold-grad" />
      </div>
      <span className="text-t12 text-muted-foreground">{label ?? t('common.loading')}</span>
    </div>
  );
}
