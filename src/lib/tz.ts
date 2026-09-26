// Timezone-aware conversion of wall-clock birth time → UTC Date, using the IANA tz
// database via Intl (handles DST + historical changes).

function tzOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const asUTC = Date.UTC(
    get('year'), get('month') - 1, get('day'),
    get('hour') % 24, get('minute'), get('second'),
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** Convert wall-clock time in a timezone → UTC Date. */
export function zonedToUTC(
  y: number, m: number, d: number,
  hh: number, mm: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const off1 = tzOffsetMinutes(timeZone, new Date(guess));
  const ts = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(timeZone, new Date(ts));
  return new Date(guess - off2 * 60000);
}

/** Offset (minutes) in effect at a given instant for a timezone. */
export function offsetAt(timeZone: string, date: Date): number {
  return tzOffsetMinutes(timeZone, date);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** YYYY-MM-DD in a given timezone (local calendar date). */
export function ymdInZone(timeZone: string, date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  return parts; // en-CA gives YYYY-MM-DD
}

/** Weekday index (0=Sunday) in a given timezone. */
export function weekdayInZone(timeZone: string, date: Date): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

/** Formatted local time string HH:MM in zone. */
export function timeInZone(timeZone: string, date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}
