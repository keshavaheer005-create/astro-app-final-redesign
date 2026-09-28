// ─── Vimshottari Dasha ───────────────────────────────────────────────────────

import { DASHA_YEARS, DASHA_SEQUENCE, NAKSHATRA_LORDS, nakshatraIndex, norm360, PlanetKey } from './constants';

const YEAR_DAYS = 365.2425;

export interface Antardasha {
  lord: PlanetKey;
  start: string; // ISO date
  end: string;
}

export interface Mahadasha {
  lord: PlanetKey;
  start: string;
  end: string;
  years: number;
  antardashas: Antardasha[];
}

function addYears(iso: Date, years: number): Date {
  return new Date(iso.getTime() + years * YEAR_DAYS * 86400000);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Full Vimshottari dasha tree from birth. */
export function vimshottariDasha(moonSiderealLon: number, birthUTC: Date): {
  mahadashas: Mahadasha[];
  balanceAtBirth: { lord: PlanetKey; yearsLeft: number };
  current: { maha: Mahadasha; antar: Antardasha } | null;
} {
  const nak = nakshatraIndex(moonSiderealLon);
  const nakSpan = 360 / 27;
  const fracIntoNak = (norm360(moonSiderealLon) % nakSpan) / nakSpan;
  const startLord = NAKSHATRA_LORDS[nak];
  const lordIdx = DASHA_SEQUENCE.indexOf(startLord);
  const totalYears = DASHA_YEARS[startLord];
  const balanceAtBirth = { lord: startLord, yearsLeft: totalYears * (1 - fracIntoNak) };

  const mahadashas: Mahadasha[] = [];
  let cursor = new Date(birthUTC.getTime() - fracIntoNak * totalYears * YEAR_DAYS * 86400000);

  for (let i = 0; i < 9; i++) {
    const lord = DASHA_SEQUENCE[(lordIdx + i) % 9];
    const years = DASHA_YEARS[lord];
    const start = new Date(cursor);
    const end = addYears(start, years);

    // Antardashas: begin with the mahadasha lord, proceed through sequence
    const antardashas: Antardasha[] = [];
    let acursor = new Date(start);
    const lordPos = DASHA_SEQUENCE.indexOf(lord);
    for (let j = 0; j < 9; j++) {
      const subLord = DASHA_SEQUENCE[(lordPos + j) % 9];
      const subYears = (years * DASHA_YEARS[subLord]) / 120;
      const aStart = new Date(acursor);
      const aEnd = addYears(aStart, subYears);
      antardashas.push({ lord: subLord, start: iso(aStart), end: iso(aEnd) });
      acursor = aEnd;
    }

    mahadashas.push({ lord, start: iso(start), end: iso(end), years, antardashas });
    cursor = end;
  }

  const now = new Date();
  const curMaha = mahadashas.find((m) => m.start <= iso(now) && m.end > iso(now)) || null;
  let current: { maha: Mahadasha; antar: Antardasha } | null = null;
  if (curMaha) {
    const curAntar = curMaha.antardashas.find((a) => a.start <= iso(now) && a.end > iso(now)) || null;
    current = { maha: curMaha, antar: curAntar! };
  }

  return { mahadashas, balanceAtBirth, current };
}

export function dashaSnapshot(dasha: ReturnType<typeof vimshottariDasha>) {
  if (!dasha.current) return null;
  return {
    mahaLord: dasha.current.maha.lord,
    antarLord: dasha.current.antar?.lord ?? null,
    mahaStart: dasha.current.maha.start,
    mahaEnd: dasha.current.maha.end,
    antarStart: dasha.current.antar?.start ?? null,
    antarEnd: dasha.current.antar?.end ?? null,
  };
}
