import * as React from 'react';

/**
 * A realistic moon for the Home screen.
 *
 *  • Correct phase geometry — the lit part is the true crescent / half / gibbous
 *    shape, lit on the RIGHT while waxing and on the LEFT while waning (as seen
 *    from India / the northern hemisphere).
 *  • The surface never mirrors: dark "seas" (maria), craters and the bright Tycho
 *    ray crater always sit where they do in the sky; only the shadow moves.
 *  • The unlit side keeps a faint blue-grey earthshine so a thin crescent still
 *    reads as a whole moon, like the real thing.
 *  • Plain SVG, static (no animation, no filters) — free to draw.
 *
 * phase: 0..1 (0 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter).
 */

const R = 48; // moon radius inside a 0..100 box (leaves room for the glow)

/** The lit region as an SVG path in a coordinate space where the lit side is the RIGHT. */
function litPath(k: number): string {
  // k = cos(2πp): 1 at new → −1 at full. The terminator is an ellipse of x-radius R·|k|.
  const rx = Math.max(0.01, R * Math.abs(k));
  const top = `50 ${50 - R}`;
  const bottom = `50 ${50 + R}`;
  // right half-circle limb, then back up along the terminator
  const sweep = k > 0 ? 0 : 1; // crescent: terminator bulges right; gibbous: bulges left
  return `M${top} A${R} ${R} 0 0 1 ${bottom} A${rx} ${R} 0 0 ${sweep} ${top} Z`;
}

// Dark seas, north up (Mare Crisium upper-right, Oceanus Procellarum left, Tycho at the bottom).
const MARIA: { cx: number; cy: number; rx: number; ry: number; rot: number }[] = [
  { cx: 27, cy: 46, rx: 11, ry: 19, rot: -14 }, // Oceanus Procellarum
  { cx: 38, cy: 29, rx: 12, ry: 9, rot: -10 }, //  Mare Imbrium
  { cx: 57, cy: 30, rx: 7.5, ry: 7, rot: 0 }, //   Mare Serenitatis
  { cx: 62, cy: 46, rx: 11, ry: 7.5, rot: 14 }, // Mare Tranquillitatis
  { cx: 73, cy: 59, rx: 6, ry: 8, rot: 22 }, //    Mare Fecunditatis
  { cx: 77, cy: 35, rx: 4.6, ry: 3.6, rot: 0 }, // Mare Crisium
  { cx: 41, cy: 66, rx: 9, ry: 6, rot: -8 }, //    Mare Nubium
  { cx: 27, cy: 65, rx: 4.8, ry: 4.8, rot: 0 }, // Mare Humorum
  { cx: 48, cy: 15, rx: 14, ry: 3.2, rot: 0 }, //  Mare Frigoris
];

export function RealisticMoon({
  phase,
  size = 64,
  className,
}: {
  phase: number;
  size?: number;
  className?: string;
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const p = ((phase % 1) + 1) % 1;
  const k = Math.cos(2 * Math.PI * p);
  const illum = (1 - k) / 2; // 0 new → 1 full
  const waxing = p < 0.5;
  const showLit = illum > 0.012;
  const full = illum > 0.988;
  const detail = size >= 30; // tiny sizes skip craters so the shape stays crisp

  const idDisc = `md${uid}`;
  const idLit = `ml${uid}`;
  const gLit = `mg${uid}`;
  const gDark = `mk${uid}`;
  const gGlow = `mw${uid}`;
  const gLimb = `mb${uid}`;

  // waning → the lit region is mirrored; the surface drawn inside it is NOT
  const mirror = waxing ? undefined : 'translate(100 0) scale(-1 1)';

  const seas = (
    <g>
      {MARIA.map((m, i) => (
        <ellipse key={i} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} transform={`rotate(${m.rot} ${m.cx} ${m.cy})`} />
      ))}
    </g>
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="-6 -6 112 112"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={gGlow} cx="50%" cy="50%" r="50%">
          <stop offset="0.55" stopColor="#F3E3A8" stopOpacity="0.45" />
          <stop offset="1" stopColor="#F3E3A8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={gLit} cx="40%" cy="34%" r="75%">
          <stop offset="0" stopColor="#FFFDF3" />
          <stop offset="0.5" stopColor="#F4ECD3" />
          <stop offset="0.85" stopColor="#DCD2B6" />
          <stop offset="1" stopColor="#C4B998" />
        </radialGradient>
        <radialGradient id={gDark} cx="42%" cy="36%" r="78%">
          <stop offset="0" stopColor="#4A5170" />
          <stop offset="1" stopColor="#262A40" />
        </radialGradient>
        {/* gentle darkening toward the limb gives the disc its roundness */}
        <radialGradient id={gLimb} cx="50%" cy="50%" r="50%">
          <stop offset="0.7" stopColor="#6B5A2E" stopOpacity="0" />
          <stop offset="1" stopColor="#6B5A2E" stopOpacity="0.34" />
        </radialGradient>
        <clipPath id={idDisc}>
          <circle cx="50" cy="50" r={R} />
        </clipPath>
        <clipPath id={idLit}>
          <path d={litPath(k)} transform={mirror} />
        </clipPath>
      </defs>

      {/* soft halo */}
      <circle cx="50" cy="50" r="56" fill={`url(#${gGlow})`} />

      {/* unlit side: deep blue-grey with faint earthshine on the seas */}
      <circle cx="50" cy="50" r={R} fill={`url(#${gDark})`} />
      {detail && (
        <g clipPath={`url(#${idDisc})`} fill="#8C93B8" opacity="0.16">
          {seas}
        </g>
      )}

      {/* lit side */}
      {showLit && (
        <g clipPath={full ? `url(#${idDisc})` : `url(#${idLit})`}>
          <circle cx="50" cy="50" r={R} fill={`url(#${gLit})`} />
          <g clipPath={`url(#${idDisc})`}>
            <g fill="#9A9382" opacity="0.5">
              {seas}
            </g>
            {detail && (
              <g>
                {/* craters: Copernicus, Kepler, Aristarchus (bright) and Plato (dark) */}
                <circle cx="36" cy="47" r="2.2" fill="#FFFFFF" opacity="0.55" />
                <circle cx="29" cy="51" r="1.2" fill="#FFFFFF" opacity="0.5" />
                <circle cx="23" cy="40" r="1.4" fill="#FFFFFF" opacity="0.75" />
                <ellipse cx="44" cy="22" rx="2.6" ry="1.8" fill="#7D776A" opacity="0.55" />
                {/* Tycho and its rays */}
                <g stroke="#FFFFFF" strokeLinecap="round" opacity="0.35" strokeWidth="0.7">
                  <path d="M45 83 L45 66M45 83 L33 70M45 83 L58 72M45 83 L52 95M45 83 L36 94" />
                </g>
                <circle cx="45" cy="83" r="1.7" fill="#FFFFFF" opacity="0.9" />
              </g>
            )}
            <circle cx="50" cy="50" r={R} fill={`url(#${gLimb})`} />
          </g>
        </g>
      )}

      {/* fine gold rim keeps it on-brand */}
      <circle cx="50" cy="50" r={R} fill="none" stroke="#C9A227" strokeOpacity="0.55" strokeWidth="1" />
    </svg>
  );
}
