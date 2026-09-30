'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { SIGNS, SIGNS_HI, PlanetKey } from '@/lib/astro/constants';
import { cn } from '@/lib/utils';

export type ChartKey = PlanetKey | 'Ur' | 'Ne' | 'Pl';

export interface ChartPlanet {
  key: ChartKey;
  sign: number;
  retrograde?: boolean;
  /** Degree within the sign (0-30). Shown as a small superscript like AstroSage. */
  deg?: number;
  combust?: boolean;
}

const SHORT: Record<ChartKey, string> = {
  Su: 'Su', Mo: 'Mo', Ma: 'Ma', Me: 'Me', Ju: 'Ju', Ve: 'Ve', Sa: 'Sa', Ra: 'Ra', Ke: 'Ke', Ur: 'Ur', Ne: 'Ne', Pl: 'Pl',
};
const OUTER_KEYS: ChartKey[] = ['Ur', 'Ne', 'Pl'];

// ─── Shared drawing helpers ───────────────────────────────────────────────────
const LINE = 'rgba(176,138,30,0.75)';
const LINE_W = 1.4;

const HI_ABBR: Record<ChartKey, string> = { Su: 'सू', Mo: 'चं', Ma: 'मं', Me: 'बु', Ju: 'गु', Ve: 'शु', Sa: 'श', Ra: 'रा', Ke: 'के', Ur: 'यू', Ne: 'ने', Pl: 'प्ल' };

const isNode = (k: ChartKey) => k === 'Ra' || k === 'Ke';
/** AstroSage marks: * = retrograde, ^ = combust. Nodes are always retrograde, so unmarked. */
const planetMark = (p: ChartPlanet) => `${p.retrograde && !isNode(p.key) ? '*' : ''}${p.combust ? '^' : ''}`;
const planetColor = (p: ChartPlanet) =>
  OUTER_KEYS.includes(p.key) ? '#6b5b95' : p.retrograde && !isNode(p.key) ? '#6B2737' : '#7a5c0a';

/** Draw planet abbreviations (+ degree superscript + marks) as SVG text, wrapped into centred rows. */
function PlanetText({ items, cx, cy, perRow, hi, size = 13 }: { items: ChartPlanet[]; cx: number; cy: number; perRow: number; hi: boolean; size?: number }) {
  if (items.length === 0) return null;
  const rows: ChartPlanet[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  const rowH = size + 6;
  const top = cy - ((rows.length - 1) * rowH) / 2;
  return (
    <g>
      {rows.map((row, r) => (
        <text key={r} x={cx} y={top + r * rowH} textAnchor="middle" dominantBaseline="middle" fontSize={size} fontWeight={700}>
          {row.map((p, i) => (
            <React.Fragment key={p.key}>
              <tspan dx={i === 0 ? 0 : 8} fill={planetColor(p)}>{hi ? HI_ABBR[p.key] : SHORT[p.key]}</tspan>
              {p.deg != null && (
                <tspan dy={-4} fontSize={Math.round(size * 0.62)} fontWeight={600} fill={planetColor(p)}>
                  {String(Math.floor(p.deg)).padStart(2, '0')}
                </tspan>
              )}
              <tspan dy={p.deg != null ? 4 : 0} fill={planetColor(p)}>{planetMark(p)}</tspan>
            </React.Fragment>
          ))}
        </text>
      ))}
    </g>
  );
}

/**
 * North Indian chart (AstroSage / classical layout).
 *
 * Geometry: outer square + BOTH diagonals + the INNER DIAMOND (midpoints of the
 * four sides joined). That yields 4 diamonds (houses 1, 4, 7, 10) and 8
 * triangles (2, 3, 5, 6, 8, 9, 11, 12). House 1 (Lagna) is always the top
 * diamond; houses run anti-clockwise.
 *
 * Numbering: like AstroSage, each house shows the SIGN NUMBER (1 = Aries …
 * 12 = Pisces) in the corner nearest the chart centre — the house itself is
 * identified by its fixed position.
 */
export function NorthChart({ ascSign, planets, className }: { ascSign: number; planets: ChartPlanet[]; className?: string }) {
  const { i18n } = useTranslation();
  const hi = i18n.language === 'hi';

  const A = 4, B = 396, M = 200; // square edges + midpoint
  const Q1 = 102, Q3 = 298;      // diagonal ∩ inner-diamond points

  // House polygons (index 0 = house 1), anti-clockwise from the top diamond.
  const shapes: string[] = [
    `${M},${A} ${Q1},${Q1} ${M},${M} ${Q3},${Q1}`,   // 1  top diamond
    `${A},${A} ${M},${A} ${Q1},${Q1}`,               // 2  top-left triangle
    `${A},${A} ${Q1},${Q1} ${A},${M}`,               // 3  left-top triangle
    `${A},${M} ${Q1},${Q1} ${M},${M} ${Q1},${Q3}`,   // 4  left diamond
    `${A},${M} ${Q1},${Q3} ${A},${B}`,               // 5  left-bottom triangle
    `${A},${B} ${Q1},${Q3} ${M},${B}`,               // 6  bottom-left triangle
    `${M},${B} ${Q1},${Q3} ${M},${M} ${Q3},${Q3}`,   // 7  bottom diamond
    `${M},${B} ${Q3},${Q3} ${B},${B}`,               // 8  bottom-right triangle
    `${B},${B} ${Q3},${Q3} ${B},${M}`,               // 9  right-bottom triangle
    `${B},${M} ${Q3},${Q3} ${M},${M} ${Q3},${Q1}`,   // 10 right diamond
    `${B},${M} ${Q3},${Q1} ${B},${A}`,               // 11 right-top triangle
    `${B},${A} ${Q3},${Q1} ${M},${A}`,               // 12 top-right triangle
  ];

  // Where the sign number sits (near the inner corner of each house, like AstroSage).
  const numPos: [number, number][] = [
    [200, 186], [102, 86], [84, 106], [186, 200], [84, 296], [102, 316],
    [200, 214], [298, 316], [316, 296], [214, 200], [316, 106], [298, 86],
  ];
  // Where planets sit (visual centre of the free area) + tags per row.
  const planetPos: { at: [number, number]; perRow: number }[] = [
    { at: [200, 108], perRow: 3 }, { at: [102, 40], perRow: 2 }, { at: [40, 108], perRow: 1 },
    { at: [104, 200], perRow: 2 }, { at: [40, 296], perRow: 1 }, { at: [102, 360], perRow: 2 },
    { at: [200, 296], perRow: 3 }, { at: [298, 360], perRow: 2 }, { at: [360, 296], perRow: 1 },
    { at: [296, 200], perRow: 2 }, { at: [360, 108], perRow: 1 }, { at: [298, 40], perRow: 2 },
  ];

  return (
    <svg viewBox="0 0 400 400" className={cn('w-full max-w-md mx-auto', className)} role="img" aria-label="North Indian chart">
      {/* Lagna (house 1) tint */}
      <polygon points={shapes[0]} fill="rgba(201,162,39,0.10)" />

      {/* Frame: outer square, both diagonals, inner diamond */}
      <rect x={A} y={A} width={B - A} height={B - A} fill="none" stroke={LINE} strokeWidth={LINE_W + 0.2} />
      <line x1={A} y1={A} x2={B} y2={B} stroke={LINE} strokeWidth={LINE_W} />
      <line x1={B} y1={A} x2={A} y2={B} stroke={LINE} strokeWidth={LINE_W} />
      <polygon points={`${M},${A} ${B},${M} ${M},${B} ${A},${M}`} fill="none" stroke={LINE} strokeWidth={LINE_W} />

      {shapes.map((_, h) => {
        const sign = (ascSign + h) % 12;
        const inHouse = planets.filter((p) => p.sign === sign);
        const [nx, ny] = numPos[h];
        const pp = planetPos[h];
        return (
          <g key={h}>
            <text
              x={nx}
              y={ny}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
              fontWeight={h === 0 ? 800 : 600}
              fill={h === 0 ? '#8a6d10' : '#a68a3a'}
              aria-label={`House ${h + 1}: ${SIGNS[sign]}`}
            >
              {sign + 1}
            </text>
            <PlanetText items={inHouse} cx={pp.at[0]} cy={pp.at[1]} perRow={pp.perRow} hi={hi} size={inHouse.length > 4 ? 11 : inHouse.length > 3 ? 12 : 13} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * South Indian chart — signs are fixed (Pisces top-left, Aries next, clockwise),
 * houses rotate. 4×4 grid; the centre 2×2 is left open (no lines through it),
 * the ascendant cell is marked with the classic diagonal slash + "Asc".
 */
export function SouthChart({ ascSign, planets, className }: { ascSign: number; planets: ChartPlanet[]; className?: string }) {
  const { i18n } = useTranslation();
  const hi = i18n.language === 'hi';

  const o = 4;              // outer margin
  const cell = 98;          // 4 × 98 = 392
  const at = (i: number) => o + i * cell;
  const cells: { sign: number; col: number; row: number }[] = [
    { sign: 11, col: 0, row: 0 }, { sign: 0, col: 1, row: 0 }, { sign: 1, col: 2, row: 0 }, { sign: 2, col: 3, row: 0 },
    { sign: 3, col: 3, row: 1 }, { sign: 4, col: 3, row: 2 },
    { sign: 5, col: 3, row: 3 }, { sign: 6, col: 2, row: 3 }, { sign: 7, col: 1, row: 3 }, { sign: 8, col: 0, row: 3 },
    { sign: 9, col: 0, row: 2 }, { sign: 10, col: 0, row: 1 },
  ];
  const houseOf = (sign: number) => (((sign - ascSign) % 12) + 12) % 12 + 1;

  return (
    <svg viewBox="0 0 400 400" className={cn('w-full max-w-md mx-auto', className)} role="img" aria-label="South Indian chart">
      {cells.map(({ sign, col, row }) => {
        const x = at(col), y = at(row);
        const isAsc = sign === ascSign;
        const inSign = planets.filter((p) => p.sign === sign);
        return (
          <g key={sign}>
            <rect x={x} y={y} width={cell} height={cell} fill={isAsc ? 'rgba(201,162,39,0.10)' : 'none'} stroke={LINE} strokeWidth={LINE_W} />
            {isAsc && (
              <>
                {/* classic ascendant slash in the top-left corner */}
                <line x1={x} y1={y + 24} x2={x + 24} y2={y} stroke={LINE} strokeWidth={LINE_W} />
                <text x={x + 6} y={y + 34} fontSize={9} fontWeight={800} fill="#8a6d10" letterSpacing="0.5">Asc</text>
              </>
            )}
            {/* house number, small, top-right */}
            <text x={x + cell - 7} y={y + 14} textAnchor="end" fontSize={10} fill="#a68a3a">{houseOf(sign)}</text>
            <PlanetText items={inSign} cx={x + cell / 2} cy={y + cell / 2 + 6} perRow={2} hi={hi} size={inSign.length > 4 ? 12 : 13} />
          </g>
        );
      })}
      {/* centre label */}
      <text x={200} y={196} textAnchor="middle" fontSize={15} fontWeight={600} fill="#a68a3a" className="font-serif">
        {hi ? 'राशि' : 'Rāśi'}
      </text>
      <text x={200} y={216} textAnchor="middle" fontSize={11} fill="#b9a56a">
        {hi ? SIGNS_HI[ascSign] : SIGNS[ascSign]} {hi ? 'लग्न' : 'Lagna'}
      </text>
    </svg>
  );
}

export function chartPlanetsFrom(planets: { key: PlanetKey; sign: number; retrograde: boolean }[], _ascSign: number): ChartPlanet[] {
  return planets.map((p) => ({ key: p.key, sign: p.sign, retrograde: p.retrograde })).concat();
}
