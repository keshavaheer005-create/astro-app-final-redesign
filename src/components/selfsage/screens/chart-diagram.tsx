'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { SIGNS, SIGNS_HI, PlanetKey } from '@/lib/astro/constants';
import { cn } from '@/lib/utils';

export interface ChartPlanet {
  key: PlanetKey;
  sign: number;
  retrograde?: boolean;
}

const SHORT: Record<PlanetKey, string> = {
  Su: 'Su', Mo: 'Mo', Ma: 'Ma', Me: 'Me', Ju: 'Ju', Ve: 'Ve', Sa: 'Sa', Ra: 'Ra', Ke: 'Ke',
};

function PlanetTag({ p, hi }: { p: ChartPlanet; hi: boolean }) {
  const label = hi ? { Su: 'सू', Mo: 'चं', Ma: 'मं', Me: 'बु', Ju: 'गु', Ve: 'शु', Sa: 'श', Ra: 'रा', Ke: 'के' }[p.key] : SHORT[p.key];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1 py-px text-[10px] font-bold leading-tight',
        p.retrograde ? 'bg-maroon-soft text-maroon' : 'bg-gold-soft text-[#8a6d10]',
      )}
    >
      {label}{p.retrograde ? (hi ? 'व' : '℞') : ''}
    </span>
  );
}

/** North Indian chart — fixed house diamonds, rotating signs. */
export function NorthChart({ ascSign, planets, className }: { ascSign: number; planets: ChartPlanet[]; className?: string }) {
  const { i18n } = useTranslation();
  const hi = i18n.language === 'hi';

  // house centers (x, y, angle for label placement)
  const centers: [number, number][] = [
    [200, 95], [108, 45], [40, 110], [105, 200], [40, 290], [108, 355],
    [200, 305], [292, 355], [360, 290], [295, 200], [360, 110], [292, 45],
  ];

  return (
    <svg viewBox="0 0 400 400" className={cn('w-full max-w-md mx-auto', className)} role="img" aria-label="North Indian chart">
      <rect x="4" y="4" width="392" height="392" fill="none" stroke="rgba(201,162,39,0.55)" strokeWidth="1.6" rx="10" />
      {/* diagonals */}
      <line x1="4" y1="4" x2="396" y2="396" stroke="rgba(201,162,39,0.4)" strokeWidth="1.1" />
      <line x1="396" y1="4" x2="4" y2="396" stroke="rgba(201,162,39,0.4)" strokeWidth="1.1" />
      {/* midpoint lines */}
      <line x1="200" y1="4" x2="200" y2="396" stroke="rgba(201,162,39,0.4)" strokeWidth="1.1" />
      <line x1="4" y1="200" x2="396" y2="200" stroke="rgba(201,162,39,0.4)" strokeWidth="1.1" />

      {Array.from({ length: 12 }, (_, h) => {
        const sign = (ascSign + h) % 12;
        const [cx, cy] = centers[h];
        const inHouse = planets.filter((p) => p.sign === sign);
        return (
          <g key={h}>
            <text x={cx} y={cy - 22} textAnchor="middle" className="fill-[#b08a1e] text-[13px] font-semibold" fontSize="13">
              {h + 1}
            </text>
            <text x={cx} y={cy - 8} textAnchor="middle" fontSize="10" className="fill-[#8b7a55]">
              {hi ? SIGNS_HI[sign] : SIGNS[sign].slice(0, 3)}
            </text>
          </g>
        );
      })}
      {/* re-render planets with proper wrap: rows of tags per house */}
      {Array.from({ length: 12 }, (_, h) => {
        const sign = (ascSign + h) % 12;
        const inHouse = planets.filter((p) => p.sign === sign);
        if (inHouse.length === 0) return null;
        const [cx, cy] = centers[h];
        return (
          <foreignObject key={`p${h}`} x={cx - 34} y={cy - 2} width="72" height="40">
            <div xmlns="http://www.w3.org/1999/xhtml" className="flex flex-wrap gap-0.5 justify-center content-start">
              {inHouse.map((p) => (
                <PlanetTag key={p.key} p={p} hi={hi} />
              ))}
            </div>
          </foreignObject>
        );
      })}
    </svg>
  );
}

/** South Indian chart — fixed signs, rotating houses. */
export function SouthChart({ ascSign, planets, className }: { ascSign: number; planets: ChartPlanet[]; className?: string }) {
  const { i18n } = useTranslation();
  const hi = i18n.language === 'hi';

  const cell = 98;
  const positions: { sign: number; x: number; y: number; corner: boolean }[] = [
    { sign: 11, x: 0, y: 0, corner: true }, { sign: 0, x: 1, y: 0, corner: false }, { sign: 1, x: 2, y: 0, corner: false }, { sign: 2, x: 3, y: 0, corner: true },
    { sign: 3, x: 3, y: 1, corner: false }, { sign: 4, x: 3, y: 2, corner: false },
    { sign: 5, x: 3, y: 3, corner: true }, { sign: 6, x: 2, y: 3, corner: false }, { sign: 7, x: 1, y: 3, corner: false }, { sign: 8, x: 0, y: 3, corner: true },
    { sign: 9, x: 0, y: 2, corner: false }, { sign: 10, x: 0, y: 1, corner: false },
  ];
  const houseOf = (sign: number) => ((sign - ascSign) % 12 + 12) % 12 + 1;

  return (
    <svg viewBox="0 0 400 400" className={cn('w-full max-w-md mx-auto', className)} role="img" aria-label="South Indian chart">
      <rect x="2" y="2" width="396" height="396" fill="none" stroke="rgba(201,162,39,0.55)" strokeWidth="1.6" rx="8" />
      {[1, 2, 3].map((i) => (
        <g key={`v${i}`}>
          <line x1={i * cell + 2} y1="2" x2={i * cell + 2} y2="398" stroke="rgba(201,162,39,0.4)" strokeWidth="1.1" />
          <line x1="2" y1={i * cell + 2} x2="398" y2={i * cell + 2} stroke="rgba(201,162,39,0.4)" strokeWidth="1.1" />
        </g>
      ))}
      {/* center X through middle 2x2 */}
      <line x1={cell + 2} y1={cell + 2} x2={3 * cell + 2} y2={3 * cell + 2} stroke="rgba(201,162,39,0.4)" strokeWidth="1.1" />
      <line x1={3 * cell + 2} y1={cell + 2} x2={cell + 2} y2={3 * cell + 2} stroke="rgba(201,162,39,0.4)" strokeWidth="1.1" />

      {positions.map(({ sign, x, y, corner }) => {
        const house = houseOf(sign);
        const inSign = planets.filter((p) => p.sign === sign);
        const cx = corner ? x * cell + cell : x * cell + cell / 2 + 2;
        const cy = corner ? y * cell + cell : y * cell + cell / 2 + 2;
        const wx = corner ? 2 * cell : cell;
        return (
          <g key={sign}>
            {corner && (
              <rect x={x * cell + 2} y={y * cell + 2} width={wx} height={wx} fill="none" stroke="rgba(201,162,39,0.35)" strokeWidth="0.8" />
            )}
            <text x={cx - 30} y={cy - 26} fontSize="10" className="fill-[#8b7a55]" textAnchor="middle">
              {hi ? SIGNS_HI[sign] : SIGNS[sign].slice(0, 3)}
            </text>
            <text x={cx - 30} y={cy - 40} fontSize="12" className="fill-[#b08a1e] font-semibold" textAnchor="middle">
              {house}
            </text>
            <foreignObject x={cx - 38} y={cy - 24} width="84" height="56">
              <div xmlns="http://www.w3.org/1999/xhtml" className="flex flex-wrap gap-0.5 justify-center content-start">
                {inSign.map((p) => (
                  <PlanetTag key={p.key} p={p} hi={hi} />
                ))}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}

export function chartPlanetsFrom(planets: { key: PlanetKey; sign: number; retrograde: boolean }[], ascSign: number): ChartPlanet[] {
  return planets.map((p) => ({ key: p.key, sign: p.sign, retrograde: p.retrograde })).concat();
}
