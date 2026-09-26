import React from 'react';

export type IconName =
  | 'home' | 'chart' | 'journal' | 'chat' | 'user' | 'bell'
  | 'sun' | 'moon' | 'planet' | 'star' | 'sparkle' | 'flame'
  | 'calendar' | 'clock' | 'pin' | 'search' | 'locate' | 'settings'
  | 'globe' | 'sunrise' | 'sunset' | 'heart' | 'trending' | 'shield'
  | 'warning' | 'info' | 'check' | 'x' | 'chevron-right' | 'chevron-down'
  | 'chevron-left' | 'arrow-right' | 'arrow-left' | 'send' | 'plus'
  | 'edit' | 'lotus' | 'om' | 'compass' | 'list' | 'download' | 'refresh'
  | 'book' | 'scale' | 'handshake' | 'timeline' | 'grid' | 'eye' | 'logout';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M4 11.2 12 4l8 7.2M6 9.8V20h4.5v-5.2h3V20H18V9.8" />,
  chart: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
      <path d="M7 7h0M17 7h0M7 17h0M17 17h0" strokeWidth="2" />
    </>
  ),
  journal: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18a1 1 0 0 1 1 1v14.5" />
      <path d="M5 4.5V19a1.5 1.5 0 0 0 1.5 1.5H19" />
      <path d="M19 16.5H6.8A1.8 1.8 0 0 0 5 18.3" />
      <path d="M9 8h6M9 11.5h4" />
    </>
  ),
  chat: <path d="M20 11.6a7.5 7.5 0 0 1-7.9 7.4 8.6 8.6 0 0 1-2.6-.4L5 20l1.2-3.4A7.1 7.1 0 0 1 4.5 12 7.5 7.5 0 0 1 12.4 4.5 7.5 7.5 0 0 1 20 11.6Z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.8-3.4 3.6-5.2 7-5.2s6.2 1.8 7 5.2" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" />
    </>
  ),
  moon: <path d="M20 13.5A8 8 0 0 1 10.5 4a8 8 0 1 0 9.5 9.5Z" />,
  planet: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M17.2 8.6c2.2.4 3.6 1.2 3.7 2.2.2 1.4-3.4 2.4-8.1 3.4s-8.6 1.3-8.8-.1c-.1-1 1.3-2 3.5-2.6" />
    </>
  ),
  star: <path d="m12 3.5 2.4 5 5.6.7-4.1 3.8 1.1 5.5L12 15.8l-5 2.7 1.1-5.5L4 9.2l5.6-.7Z" />,
  sparkle: (
    <>
      <path d="M12 4v0c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6Z" />
      <path d="M18.5 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.2-2.2.9-2.5 2.5-.3-1.6-1-2.3-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5Z" />
    </>
  ),
  flame: <path d="M12 3.5c.4 3-1.2 4.6-2.8 6.3C7.6 11.5 6.5 13 6.5 15a5.5 5.5 0 0 0 11 0c0-2.3-1-4-2.3-5.5-.3 1-.9 1.7-1.7 2 .3-2.7-.2-5.6-1.5-8Z" />,
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.4-6.5-10.2a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  locate: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.2-1.6l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.7-1.6L13.4 2.4h-2.8l-.4 2.5a7 7 0 0 0-2.7 1.6l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .5.1 1.1.2 1.6l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.7 1.6l.4 2.5h2.8l.4-2.5a7 7 0 0 0 2.7-1.6l2.3 1 2-3.4-2-1.5c.1-.5.2-1.1.2-1.6Z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5s1.2-6.2 3.6-8.5Z" />
    </>
  ),
  sunrise: (
    <>
      <path d="M3 18h18M6.5 14.5a5.5 5.5 0 0 1 11 0" />
      <path d="M12 4v3M5 8l1.6 1.6M19 8l-1.6 1.6M2.5 14.5H4M20 14.5h1.5" />
    </>
  ),
  sunset: (
    <>
      <path d="M3 18h18M6.5 14.5a5.5 5.5 0 0 1 11 0" />
      <path d="M12 7V4M5 8l1.6 1.6M19 8l-1.6 1.6M2.5 14.5H4M20 14.5h1.5" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />,
  trending: <path d="m4 16 5-5 3.5 3.5L20 7m0 0h-5m5 0v5" />,
  shield: <path d="M12 3.5 19 6v6c0 4.6-3 7.4-7 8.5-4-1.1-7-3.9-7-8.5V6Z" />,
  warning: (
    <>
      <path d="M12 4 21 19H3L12 4Z" />
      <path d="M12 10v4M12 16.8v.2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.8v.2" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  'chevron-right': <path d="m9 5.5 6.5 6.5L9 18.5" />,
  'chevron-down': <path d="m5.5 9 6.5 6.5L18.5 9" />,
  'chevron-left': <path d="M15 5.5 8.5 12 15 18.5" />,
  'arrow-right': <path d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5" />,
  'arrow-left': <path d="M20 12H5m0 0 5.5-5.5M5 12l5.5 5.5" />,
  send: <path d="M20 4 4 10.5l6 2.5m10-9-6 16-3.5-7L4 10.5M20 4l-10 9" />,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <path d="M14.5 5.5 18.5 9.5 8.5 19.5H4.5v-4L14.5 5.5ZM13 7l4 4" />,
  lotus: (
    <>
      <path d="M12 20c-2.8 0-5.4-1.5-7-3.5 1.2-.4 2.2-1 3-1.9-2-.5-3.5-1.7-4.5-3.4 2.6-.6 4.7-.3 6.5.8C9 9.6 9.8 6.7 12 4.5c2.2 2.2 3 5.1 2 7.5 1.8-1.1 3.9-1.4 6.5-.8-1 1.7-2.5 2.9-4.5 3.4.8.9 1.8 1.5 3 1.9-1.6 2-4.2 3.5-7 3.5Z" />
    </>
  ),
  om: <path d="M5 9.5c1.8-2 4.4-2 5.8-.4 1.2 1.4.8 3.3-.6 4.4 2.6.6 4.6-.4 5.6-2.3M16 8.2c.9-.5 1.9-.2 2.3.6.3.7 0 1.5-.7 1.9M9 16.5c1 1.2 2.4 1.9 4 1.6 2.4-.4 3.8-2.4 3.4-4.6M9 16.5c-.8-1-2.3-1.3-3.4-.6-.4.3-.7.7-.8 1.1" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  list: <path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  download: <path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M4.5 19.5h15" />,
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L20 9.5M20 4.5v5h-5" />,
  book: (
    <>
      <path d="M12 6.5C10.5 5 8.3 4.5 4 4.7v13.6c4.3-.2 6.5.3 8 1.7 1.5-1.4 3.7-1.9 8-1.7V4.7c-4.3-.2-6.5.3-8 1.8Z" />
      <path d="M12 6.5V20" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16M7 20h10M12 6 5.5 8M12 6l6.5 2" />
      <path d="M3 13.5a2.8 2.8 0 0 0 5.5 0L5.5 8 3 13.5ZM15.5 13.5a2.8 2.8 0 0 0 5.5 0L18.5 8l-3 5.5Z" />
    </>
  ),
  handshake: <path d="M3.5 7.5 8 6l4 3 4-3 4.5 1.5-1 6-3.5 4.5-4-3.5-4 3.5L4.5 13.5l-1-6Z" />,
  timeline: (
    <>
      <path d="M5 4.5v15" />
      <circle cx="5" cy="8" r="1.6" />
      <circle cx="5" cy="16" r="1.6" />
      <path d="M9 8h11M9 16h7" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  logout: <path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2M9.5 12H20m0 0-3.5-3.5M20 12l-3.5 3.5" />,
};

export function Icon({
  name,
  size = 20,
  className,
  strokeWidth = 1.5,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

// 12 tick marks around the logo, precomputed at module scope (rounded to 3dp)
const TICKS: [number, number, number, number][] = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  return [
    Math.round((24 + Math.cos(a) * 19.5) * 1000) / 1000,
    Math.round((24 + Math.sin(a) * 19.5) * 1000) / 1000,
    Math.round((24 + Math.cos(a) * 22.5) * 1000) / 1000,
    Math.round((24 + Math.sin(a) * 22.5) * 1000) / 1000,
  ];
});

/** Geometric sun/eclipse logo mark — works small (favicon) and large (splash). */
export function LogoMark({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-label="Self Sage logo">
      <defs>
        <linearGradient id="sg-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C9A227" />
          <stop offset="100%" stopColor="#E8C568" />
        </linearGradient>
      </defs>
      {/* radiating ticks (precomputed & rounded to keep SSR hydration identical) */}
      <g stroke="url(#sg-gold)" strokeWidth="1.6" strokeLinecap="round">
        {TICKS.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {/* eclipse disc with crescent cut */}
      <path
        d="M24 7a17 17 0 1 1 0 34 17 17 0 0 1 0-34Zm4.2 6.4A11.5 11.5 0 1 0 24 35.5c2 0 3.9-.5 5.5-1.4a11.5 11.5 0 0 1-1.3-20.7Z"
        fill="url(#sg-gold)"
        fillRule="evenodd"
      />
    </svg>
  );
}

/** Acharya Abhishek Sharma — illustrated line-art portrait (not a bot icon). */
export function AcharyaAvatar({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Acharya Abhishek Sharma">
      <circle cx="32" cy="32" r="31" fill="#2A2420" stroke="rgba(232,197,104,0.4)" strokeWidth="1.5" />
      <g stroke="#E8C568" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* shoulders / shawl */}
        <path d="M13 56c2.5-8.5 9-13 19-13s16.5 4.5 19 13" fill="none" />
        <path d="M13 56c1.8-6.2 6.4-10.4 12.6-12.1M51 56c-1.8-6.2-6.4-10.4-12.6-12.1" opacity="0.7" />
        {/* face */}
        <path d="M22 27c0-7 4.3-11.5 10-11.5S42 20 42 27c0 6.6-4.2 12.5-10 12.5S22 33.6 22 27Z" />
        {/* turban wrap */}
        <path d="M21.5 24.5c-.8-7 4.4-12.5 10.5-12.5s11.3 5.5 10.5 12.5" />
        <path d="M21.5 24.5c3.5-2.5 7-3.6 10.5-3.6s7 1.1 10.5 3.6" opacity="0.75" />
        <path d="M42.5 20.5c1.8 1.6 2.6 4 2.6 6.4" opacity="0.6" />
        {/* tilak */}
        <path d="M32 19.5v4.2" strokeWidth="2" />
        <path d="M30.6 25.2c.9.9 1.9.9 2.8 0" />
        {/* eyes (calm arcs) */}
        <path d="M26 28.5c1-1.2 2.6-1.2 3.6 0M34.4 28.5c1-1.2 2.6-1.2 3.6 0" />
        {/* nose + gentle smile */}
        <path d="M32 30.5v3.2" opacity="0.8" />
        <path d="M29 36.2c1.9 1.6 4.1 1.6 6 0" />
        {/* beard outline */}
        <path d="M23.5 30c.3 7 3.4 12.5 8.5 12.5S40.2 37 40.5 30" opacity="0.55" />
      </g>
    </svg>
  );
}
