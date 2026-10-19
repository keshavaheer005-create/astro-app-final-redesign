import * as React from 'react';

/**
 * Premium still mandala art — fine gold line-work with a soft metallic
 * gradient, scalloped lace borders, bead rings and layered lotus petals.
 *
 * - 100% still: no animation, no filters, no will-change (zero CPU/GPU cost
 *   after the first paint).
 * - Geometry is computed once at module load and emitted as a handful of
 *   <path> elements per mandala (not hundreds of nodes).
 * - Two variants so a screen never repeats one motif everywhere:
 *     "lotus" — lace border, 24 slim petals, bead ring, double lotus heart
 *     "star"  — bead border, 16 petals, octagram, 8-petal heart
 */

const C = 100;
const f = (n: number) => String(Math.round(n * 100) / 100);
/** angle for slot i of n, starting at 12 o'clock */
const A = (i: number, n: number, off = 0) => -Math.PI / 2 + (i * 2 * Math.PI) / n + off;
const pt = (r: number, a: number) => `${f(C + r * Math.cos(a))} ${f(C + r * Math.sin(a))}`;

/** Slim pointed lotus petal from radius rb (base) to rt (tip), half-width w (radians). */
const petal = (a: number, rb: number, rt: number, w: number) => {
  const d = rt - rb;
  return (
    `M${pt(rb, a)}` +
    `C${pt(rb + d * 0.22, a - w)} ${pt(rb + d * 0.7, a - w * 0.62)} ${pt(rt, a)}` +
    `C${pt(rb + d * 0.7, a + w * 0.62)} ${pt(rb + d * 0.22, a + w)} ${pt(rb, a)}Z`
  );
};

const petalRing = (n: number, rb: number, rt: number, w: number, off = 0) =>
  Array.from({ length: n }, (_, i) => petal(A(i, n, off), rb, rt, w)).join('');

/** Thin centre rib inside each petal. */
const ribRing = (n: number, r1: number, r2: number, off = 0) =>
  Array.from({ length: n }, (_, i) => `M${pt(r1, A(i, n, off))}L${pt(r2, A(i, n, off))}`).join('');

/** Round beads on a ring (zero-length round-capped segments). */
const beads = (n: number, r: number, off = 0) =>
  Array.from({ length: n }, (_, i) => `M${pt(r, A(i, n, off))}h0`).join('');

/** Lace border: n outward-bulging half-circle scallops resting on radius r. */
const scallops = (n: number, r: number) => {
  const rr = r * Math.sin(Math.PI / n);
  let d = `M${pt(r, A(0, n))}`;
  for (let i = 1; i <= n; i++) d += `A${f(rr)} ${f(rr)} 0 0 1 ${pt(r, A(i, n))}`;
  return d + 'Z';
};

/** Star polygon {n/k} on radius r (e.g. octagram {8/3}). */
const starPolygon = (n: number, k: number, r: number) => {
  let d = '';
  for (let i = 0; i < n; i++) d += `${i === 0 ? 'M' : 'L'}${pt(r, A((i * k) % n, n))}`;
  return d + 'Z';
};

/* ── LOTUS ───────────────────────────────────────────────────────────────── */
const LOTUS = {
  lace: scallops(36, 82),
  beadsOuter: beads(60, 96.25),
  petalsA: petalRing(24, 50, 79, 0.075),
  ribsA: ribRing(24, 58, 72),
  beadsMid: beads(48, 47.5, Math.PI / 48),
  petalsB: petalRing(12, 26, 45, 0.2, Math.PI / 12),
  ribsB: ribRing(12, 31, 40, Math.PI / 12),
  petalsC: petalRing(8, 10, 22, 0.3),
};

/* ── STAR ────────────────────────────────────────────────────────────────── */
const STAR = {
  beadsOuter: beads(72, 91.5),
  petalsA: petalRing(16, 56, 80, 0.1),
  ribsA: ribRing(16, 63, 74),
  beadsA: beads(16, 70, Math.PI / 16),
  octagram: starPolygon(8, 3, 50),
  petalsC: petalRing(8, 8, 15, 0.3),
};

export type MandalaVariant = 'lotus' | 'star';

export function Mandala({
  variant = 'lotus',
  size = 200,
  className,
  style,
}: {
  variant?: MandalaVariant;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  // unique, selector-safe id so several mandalas on one page never clash
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const gold = `mg${uid}`;
  const glow = `mr${uid}`;
  const stroke = `url(#${gold})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gold} gradientUnits="userSpaceOnUse" x1="14" y1="14" x2="186" y2="186">
          <stop offset="0" stopColor="#E6CB7E" />
          <stop offset="0.5" stopColor="#B88F2F" />
          <stop offset="1" stopColor="#8A6418" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#E6CB7E" stopOpacity="0.30" />
          <stop offset="0.6" stopColor="#E6CB7E" stopOpacity="0.08" />
          <stop offset="1" stopColor="#E6CB7E" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* soft warm glow behind the line-work */}
      <circle cx={C} cy={C} r="82" fill={`url(#${glow})`} />

      <g stroke={stroke}>
        {/* outer double ring (shared) */}
        <circle cx={C} cy={C} r="98" strokeWidth="1" />
        <circle cx={C} cy={C} r="94.5" strokeWidth="0.45" />

        {variant === 'lotus' ? (
          <>
            <path d={LOTUS.beadsOuter} strokeWidth="1.1" />
            <path d={LOTUS.lace} strokeWidth="0.7" />
            <circle cx={C} cy={C} r="82" strokeWidth="0.5" />
            <path d={LOTUS.petalsA} strokeWidth="0.7" fill={stroke} fillOpacity="0.07" />
            <path d={LOTUS.ribsA} strokeWidth="0.45" />
            <circle cx={C} cy={C} r="50" strokeWidth="0.6" />
            <path d={LOTUS.beadsMid} strokeWidth="1.3" />
            <path d={LOTUS.petalsB} strokeWidth="0.7" fill={stroke} fillOpacity="0.09" />
            <path d={LOTUS.ribsB} strokeWidth="0.45" />
            <circle cx={C} cy={C} r="26" strokeWidth="0.6" />
            <circle cx={C} cy={C} r="23.5" strokeWidth="0.4" />
            <path d={LOTUS.petalsC} strokeWidth="0.65" fill={stroke} fillOpacity="0.12" />
            <circle cx={C} cy={C} r="8.5" strokeWidth="0.7" />
            <circle cx={C} cy={C} r="5" strokeWidth="0.5" />
          </>
        ) : (
          <>
            <path d={STAR.beadsOuter} strokeWidth="1" />
            <circle cx={C} cy={C} r="88.5" strokeWidth="0.45" />
            <circle cx={C} cy={C} r="82" strokeWidth="0.6" />
            <path d={STAR.petalsA} strokeWidth="0.7" fill={stroke} fillOpacity="0.07" />
            <path d={STAR.ribsA} strokeWidth="0.45" />
            <path d={STAR.beadsA} strokeWidth="2.2" />
            <circle cx={C} cy={C} r="54" strokeWidth="0.6" />
            <circle cx={C} cy={C} r="51" strokeWidth="0.4" />
            <path d={STAR.octagram} strokeWidth="0.7" />
            <circle cx={C} cy={C} r="17" strokeWidth="0.5" />
            <path d={STAR.petalsC} strokeWidth="0.6" fill={stroke} fillOpacity="0.12" />
            <circle cx={C} cy={C} r="6" strokeWidth="0.6" />
          </>
        )}
        {/* bindu */}
        <circle cx={C} cy={C} r="2" fill={stroke} strokeWidth="0.3" />
      </g>
    </svg>
  );
}
