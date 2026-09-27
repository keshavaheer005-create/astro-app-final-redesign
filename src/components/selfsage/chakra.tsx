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
 * Sri Yantra line-art: bindu, interlocking triangle set, lotus gates and
 * bhupura squares. Used for the hero backdrop layer and decorative mounts.
 */
export function SriYantra({
  size = 240,
  className,
  speed = 'slow',
  strokeWidth = 1,
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
      {/* outer rings */}
      <circle cx="50" cy="50" r="48.5" />
      <circle cx="50" cy="50" r="45" />
      {/* 16-petal lotus ring */}
      <g opacity="0.75">
        {Array.from({ length: 16 }, (_, i) => (
          <path key={i} d="M50 9.5 C53.4 14 53.4 19.5 50 23 C46.6 19.5 46.6 14 50 9.5 Z" transform={`rotate(${i * 22.5} 50 50)`} />
        ))}
      </g>
      {/* interlocking triangle set (3 ascending + 3 descending) */}
      <g opacity="0.9">
        <path d="M50 17 L81 71 L19 71 Z" />
        <path d="M50 83 L19 29 L81 29 Z" />
        <path d="M50 30 L68.5 62 L31.5 62 Z" />
        <path d="M50 70 L31.5 38 L68.5 38 Z" />
        <path d="M50 41 L59.5 57.5 L40.5 57.5 Z" />
        <path d="M50 59 L40.5 42.5 L59.5 42.5 Z" />
      </g>
      {/* bhupura squares */}
      <rect x="17" y="17" width="66" height="66" opacity="0.55" />
      <rect x="13" y="13" width="74" height="74" opacity="0.4" />
      {/* bindu */}
      <path d="M50 50h0" strokeWidth={strokeWidth * 2.2} />
    </svg>
  );
}

/* MandalaAccent geometry (precomputed & rounded for SSR hydration) */
const MANDALA_PETAL = 'M50 10 C55 16 55 24 50 28 C45 24 45 16 50 10 Z';
const MANDALA_TICKS: [number, number, number, number][] = Array.from({ length: 24 }, (_, i) => {
  const a = (i * Math.PI) / 12;
  return [
    r3(50 + Math.cos(a) * 40),
    r3(50 + Math.sin(a) * 40),
    r3(50 + Math.cos(a) * 47.5),
    r3(50 + Math.sin(a) * 47.5),
  ];
});
const MANDALA_DOTS: [number, number][] = Array.from({ length: 16 }, (_, i) => {
  const a = (i * Math.PI) / 8 + Math.PI / 16;
  return [r3(50 + Math.cos(a) * 34), r3(50 + Math.sin(a) * 34)];
});

/**
 * Corner mandala — small, elegant line-art meant to peek into margins and
 * corners (half of it sits outside the viewport edge). Complements the fixed
 * ChakraBackdrop with per-screen accents; inherits currentColor so the caller
 * chooses the tint (text-emerald, text-rose, …) and keeps opacity low.
 */
export function MandalaAccent({
  size = 190,
  className,
  strokeWidth = 1,
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
      {/* outer ring + tick rays */}
      <circle cx="50" cy="50" r="47.5" />
      <g opacity="0.55">
        {MANDALA_TICKS.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {/* petal ring */}
      <g opacity="0.8">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={MANDALA_PETAL} transform={`rotate(${i * 30} 50 50)`} />
        ))}
      </g>
      {/* mid ring + dot constellation */}
      <circle cx="50" cy="50" r="28" opacity="0.85" />
      <g opacity="0.7">
        {MANDALA_DOTS.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="0.9" />
        ))}
      </g>
      {/* inner ring + heart lotus + bindu */}
      <circle cx="50" cy="50" r="12" />
      <circle cx="50" cy="50" r="6.5" opacity="0.7" />
      <path d="M50 50h0" strokeWidth={strokeWidth * 2} />
    </svg>
  );
}

/**
 * Om emblem — a refined line-art mark: an authentic ॐ glyph held inside a
 * thin, slowly counter-revolving ring (the glyph itself stays still and
 * breathes gently). Used sparingly: Acharya's empty state, onboarding,
 * contemplative loading moments.
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
      {/* slowly revolving double ring + fine ticks */}
      <g className="chakra-spin-slow-rev">
        <circle cx="50" cy="50" r="48.5" />
        <circle cx="50" cy="50" r="44.5" />
        <g opacity="0.55">
          {TICKS.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={strokeWidth * 0.8} />
          ))}
        </g>
      </g>
      {/* the glyph — authentic Devanagari Om, rendered still (font of the
          device renders it; universally available on target platforms) */}
      <text
        x="50"
        y="63.5"
        textAnchor="middle"
        fontSize="44"
        fill="currentColor"
        stroke="none"
        style={{ fontFamily: "'Noto Sans Devanagari', 'Nirmala UI', 'Mangal', serif" }}
        className="chakra-breathe"
      >
        ॐ
      </text>
    </svg>
  );
}

/**
 * Global fixed full-viewport decoration: a suspended, slowly breathing
 * composition of sacred geometry that fills the empty background on every
 * screen (app shell, onboarding, auth). Layers, back → front:
 *   1. paper-grain texture over the whole viewport
 *   2. soft corner vignette for depth
 *   3. giant zodiac ring rising from the bottom (220s rotation)
 *   4. gold Sri Yantra, top-right (90s, breathing + drifting)
 *   5. violet wheel, bottom-left (64s reverse)
 *   6. emerald wheel, left margin (140s reverse)
 *   7. violet lotus wheel, top-left margin
 *   8. rose wheel, bottom-right margin
 * Transform/opacity only; honours prefers-reduced-motion via global opt-out;
 * never intercepts clicks, never causes overflow.
 */
export function ChakraBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* 1 — handmade paper grain */}
      <div className="texture-grain absolute inset-0" />

      {/* 2 — corner vignette (depth without darkening the content zone) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(130% 95% at 50% 38%, transparent 58%, rgba(42,36,32,0.055) 100%)',
        }}
      />

      {/* 3 — zodiac ring rising from below */}
      <div className="absolute left-1/2 top-[104%] -translate-x-1/2 text-gold opacity-[0.055]">
        <div className="chakra-spin-zodiac">
          <ChakraWheel size="170vmin" speed="slow" strokeWidth={0.5} />
        </div>
      </div>

      {/* 4 — hero Sri Yantra, top-right */}
      <div className="absolute -top-[15vmin] -right-[17vmin] text-gold opacity-[0.09]">
        <div className="chakra-drift">
          <div className="chakra-breathe">
            <SriYantra size="76vmin" speed="slow" strokeWidth={0.55} />
          </div>
        </div>
      </div>

      {/* 5 — violet wheel, bottom-left */}
      <div className="absolute -bottom-[12vmin] -left-[16vmin] text-violet opacity-[0.13]">
        <div className="chakra-drift-late">
          <ChakraWheel size="56vmin" speed="mid" strokeWidth={0.6} />
        </div>
      </div>

      {/* 6 — emerald wheel, left margin */}
      <div className="absolute -left-[26vmin] top-[34%] text-emerald opacity-[0.09]">
        <ChakraWheel size="48vmin" speed="slow" strokeWidth={0.6} className="chakra-spin-slow-rev" />
      </div>

      {/* 7 — violet lotus wheel, top-left margin */}
      <div className="absolute -top-[20vmin] -left-[18vmin] text-violet opacity-[0.07]">
        <ChakraWheel size="46vmin" speed="slow" strokeWidth={0.55} className="chakra-spin-slow-rev" />
      </div>

      {/* 8 — rose wheel, bottom-right margin */}
      <div className="absolute -bottom-[16vmin] -right-[12vmin] text-rose opacity-[0.06]">
        <ChakraWheel size="44vmin" speed="slow" strokeWidth={0.55} />
      </div>
    </div>
  );
}

/**
 * ScreenGradient — the app's atmosphere engine. A fixed, full-viewport stack
 * of five rich gradient fields (gold / emerald / violet / rose / burgundy)
 * that cross-fades as tabs change, so every tab OWNS its own background
 * instead of sitting on one shared cream plane. Paints above the ChakraBackdrop
 * (z-0) and below all content (z-10); pointer-events stay off; opacity-only
 * transitions (700ms) respect the global reduced-motion opt-out.
 */
const TONE_GRADS: Record<string, string> = {
  gold:
    'radial-gradient(90% 65% at 10% -10%, rgba(212,175,55,0.36), transparent 60%),' +
    'radial-gradient(85% 60% at 95% 2%, rgba(232,197,104,0.28), transparent 58%),' +
    'radial-gradient(130% 75% at 50% 115%, rgba(201,162,39,0.20), transparent 64%),' +
    'linear-gradient(172deg, rgba(233,196,106,0.24) 0%, rgba(233,196,106,0.09) 34%, transparent 62%)',
  emerald:
    'radial-gradient(90% 65% at 8% -8%, rgba(62,142,110,0.34), transparent 60%),' +
    'radial-gradient(80% 55% at 96% 4%, rgba(127,191,164,0.26), transparent 58%),' +
    'radial-gradient(130% 75% at 50% 115%, rgba(62,142,110,0.19), transparent 64%),' +
    'linear-gradient(172deg, rgba(62,142,110,0.22) 0%, rgba(62,142,110,0.08) 34%, transparent 62%)',
  violet:
    'radial-gradient(90% 65% at 10% -10%, rgba(110,74,158,0.33), transparent 60%),' +
    'radial-gradient(85% 58% at 94% 4%, rgba(143,108,192,0.26), transparent 58%),' +
    'radial-gradient(130% 75% at 50% 115%, rgba(110,74,158,0.18), transparent 64%),' +
    'linear-gradient(172deg, rgba(110,74,158,0.21) 0%, rgba(110,74,158,0.075) 34%, transparent 62%)',
  rose:
    'radial-gradient(90% 65% at 10% -10%, rgba(194,69,90,0.31), transparent 60%),' +
    'radial-gradient(85% 58% at 94% 4%, rgba(217,112,138,0.26), transparent 58%),' +
    'radial-gradient(130% 75% at 50% 115%, rgba(194,69,90,0.17), transparent 64%),' +
    'linear-gradient(172deg, rgba(194,69,90,0.20) 0%, rgba(194,69,90,0.07) 34%, transparent 62%)',
  burgundy:
    'radial-gradient(90% 65% at 10% -10%, rgba(92,26,40,0.29), transparent 60%),' +
    'radial-gradient(85% 58% at 94% 4%, rgba(163,51,71,0.24), transparent 58%),' +
    'radial-gradient(130% 75% at 50% 115%, rgba(92,26,40,0.17), transparent 64%),' +
    'linear-gradient(172deg, rgba(92,26,40,0.19) 0%, rgba(92,26,40,0.07) 34%, transparent 62%)',
};

const TONE_KEYS = ['gold', 'emerald', 'violet', 'rose', 'burgundy'] as const;

export function ScreenGradient({ tone }: { tone: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden" aria-hidden="true">
      {TONE_KEYS.map((k) => (
        <div
          key={k}
          className="absolute inset-0 transition-opacity duration-700 ease-out will-change-[opacity]"
          style={{ background: TONE_GRADS[k], opacity: k === tone ? 1 : 0 }}
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
        <ChakraWheel size={size} speed="fast" strokeWidth={1.5} className="absolute inset-0" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full gold-grad" />
      </div>
      <span className="text-t12 text-muted-foreground">{label ?? t('common.loading')}</span>
    </div>
  );
}
