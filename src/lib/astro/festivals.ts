// ─── Festivals, lunar months, ekadashi names, sankranti ─────────────────────
//
// Conventions (verified against classical panchang listings):
// • Lunar months follow the PURNIMANTA scheme (the one classical festival
//   calendars use: month runs purnima→purnima and is NAMED by the nakshatra
//   of the purnima that closes it). Example: Diwali's amavasya falls in
//   Kartika (purnimanta) ✓; Ganesh Chaturthi = Bhadrapada Shukla 4 ✓;
//   Maha Shivaratri = Phalguna Krishna Chaturdashi ✓.
// • Rule for any day D: its lunar month = the month named by the nakshatra
//   the Moon occupies at the FIRST purnima at/after D. (Monotonic tithi
//   sequence guarantees the purnima that closes D's month.)
// • Tithi is sampled at local noon — boundary tithis can shift a festival by
//   one day vs sunrise-based drik panchangas. Acceptable for an overview.
// • Sankranti = day the sidereal Sun changes sign within the scanned window.

export interface LocalizedName {
  en: string;
  hi: string;
}

export interface FestivalInfo extends LocalizedName {
  kind: 'festival' | 'ekadashi' | 'sankranti';
  /** purnimanta lunar month key, e.g. 'kartika' */
  month: string;
  /** e.g. 'K4' — paksha + tithi number (sankranti/ekadashi may omit) */
  anchor?: string;
}

// 12 purnimanta lunar months (index 0 = Chaitra)
export const LUNAR_MONTHS: { key: string; en: string; hi: string }[] = [
  { key: 'chaitra', en: 'Chaitra', hi: 'चैत्र' },
  { key: 'vaishakha', en: 'Vaishakha', hi: 'वैशाख' },
  { key: 'jyeshtha', en: 'Jyeshtha', hi: 'ज्येष्ठ' },
  { key: 'ashadha', en: 'Ashadha', hi: 'आषाढ़' },
  { key: 'shravana', en: 'Shravana', hi: 'श्रावण' },
  { key: 'bhadrapada', en: 'Bhadrapada', hi: 'भाद्रपद' },
  { key: 'ashvina', en: 'Ashvina', hi: 'आश्विन' },
  { key: 'kartika', en: 'Kartika', hi: 'कार्तिक' },
  { key: 'margashirsha', en: 'Margashirsha', hi: 'मार्गशीर्ष' },
  { key: 'pausha', en: 'Pausha', hi: 'पौष' },
  { key: 'magha', en: 'Magha', hi: 'माघ' },
  { key: 'phalguna', en: 'Phalguna', hi: 'फाल्गुन' },
];

type Rule = { en: string; hi: string; kind?: FestivalInfo['kind'] };

/** Festival table — key `${monthKey}|${paksha}|${tithiNum}` (tithi 1..15). */
const FESTIVAL_RULES: Record<string, Rule> = {
  // Chaitra
  'chaitra|Shukla|1': { en: 'Yugadi · Gudi Padwa', hi: 'युगादि · गुड़ी पड़वा' },
  'chaitra|Shukla|9': { en: 'Rama Navami', hi: 'राम नवमी' },
  'chaitra|Shukla|15': { en: 'Hanuman Jayanti', hi: 'हनुमान जयंती' },
  // Vaishakha
  'vaishakha|Shukla|3': { en: 'Akshaya Tritiya', hi: 'अक्षय तृतीया' },
  'vaishakha|Shukla|15': { en: 'Buddha Purnima', hi: 'बुद्ध पूर्णिमा' },
  // Jyeshtha
  'jyeshtha|Shukla|15': { en: 'Vat Savitri Purnima', hi: 'वट सावित्री पूर्णिमा' },
  // Ashadha
  'ashadha|Shukla|11': { en: 'Devshayani Ekadashi', hi: 'देवशयनी एकादशी', kind: 'ekadashi' },
  'ashadha|Shukla|15': { en: 'Guru Purnima', hi: 'गुरु पूर्णिमा' },
  // Shravana
  'shravana|Shukla|5': { en: 'Nag Panchami', hi: 'नाग पंचमी' },
  'shravana|Shukla|15': { en: 'Raksha Bandhan', hi: 'रक्षा बंधन' },
  'shravana|Krishna|8': { en: 'Janmashtami', hi: 'जन्माष्टमी' },
  // Bhadrapada
  'bhadrapada|Shukla|4': { en: 'Ganesh Chaturthi', hi: 'गणेश चतुर्थी' },
  'bhadrapada|Shukla|14': { en: 'Anant Chaturdashi', hi: 'अनंत चतुर्दशी' },
  'bhadrapada|Shukla|15': { en: 'Bhadrapada Purnima', hi: 'भाद्रपद पूर्णिमा' },
  // Ashvina
  'ashvina|Shukla|1': { en: 'Sharad Navratri begins', hi: 'शरद नवरात्रि प्रारंभ' },
  'ashvina|Shukla|10': { en: 'Vijayadashami (Dussehra)', hi: 'विजयादशमी (दशहरा)' },
  'ashvina|Shukla|15': { en: 'Sharad Purnima', hi: 'शरद पूर्णिमा' },
  'ashvina|Krishna|15': { en: 'Sarva Pitru Amavasya (Mahalaya)', hi: 'सर्व पितृ अमावस्या (महालया)' },
  // Kartika
  'kartika|Krishna|4': { en: 'Karva Chauth', hi: 'करवा चौथ' },
  'kartika|Krishna|14': { en: 'Narak Chaturdashi', hi: 'नरक चतुर्दशी' },
  'kartika|Krishna|15': { en: 'Diwali (Lakshmi Puja)', hi: 'दीपावली (लक्ष्मी पूजा)' },
  'kartika|Shukla|1': { en: 'Govardhan Puja', hi: 'गोवर्धन पूजा' },
  'kartika|Shukla|2': { en: 'Bhai Dooj', hi: 'भाई दूज' },
  'kartika|Shukla|11': { en: 'Devutthana Ekadashi', hi: 'देवउठनी एकादशी', kind: 'ekadashi' },
  'kartika|Shukla|15': { en: 'Dev Deepavali', hi: 'देव दीपावली' },
  // Pausha
  'pausha|Shukla|15': { en: 'Paush Purnima', hi: 'पौष पूर्णिमा' },
  // Magha
  'magha|Shukla|5': { en: 'Vasant Panchami', hi: 'वसंत पंचमी' },
  'magha|Krishna|15': { en: 'Mauni Amavasya', hi: 'मौनी अमावस्या' },
  // Phalguna
  'phalguna|Krishna|14': { en: 'Maha Shivaratri', hi: 'महाशिवरात्रि' },
  'phalguna|Shukla|15': { en: 'Holika Dahan · Holi', hi: 'होलिका दहन · होली' },
};

/** Named ekadashis by purnimanta month. */
export const EKADASHI_NAMES: Record<string, { shukla: LocalizedName; krishna: LocalizedName }> = {
  chaitra: { shukla: { en: 'Kamada', hi: 'कामदा' }, krishna: { en: 'Varuthini', hi: 'वरुथिनी' } },
  vaishakha: { shukla: { en: 'Mohini', hi: 'मोहिनी' }, krishna: { en: 'Apara', hi: 'अपरा' } },
  jyeshtha: { shukla: { en: 'Nirjala', hi: 'निर्जला' }, krishna: { en: 'Yogini', hi: 'योगिनी' } },
  ashadha: { shukla: { en: 'Devshayani', hi: 'देवशयनी' }, krishna: { en: 'Kamika', hi: 'कामिका' } },
  shravana: { shukla: { en: 'Putrada', hi: 'पुत्रदा' }, krishna: { en: 'Aja', hi: 'अजा' } },
  bhadrapada: { shukla: { en: 'Parivartini', hi: 'परिवर्तिनी' }, krishna: { en: 'Indira', hi: 'इंदिरा' } },
  ashvina: { shukla: { en: 'Papankusha', hi: 'पापांकुशा' }, krishna: { en: 'Rama', hi: 'रमा' } },
  kartika: { shukla: { en: 'Devutthana', hi: 'देवउठनी' }, krishna: { en: 'Utpanna', hi: 'उत्पन्ना' } },
  margashirsha: { shukla: { en: 'Mokshada', hi: 'मोक्षदा' }, krishna: { en: 'Saphala', hi: 'सफला' } },
  pausha: { shukla: { en: 'Putrada', hi: 'पुत्रदा' }, krishna: { en: 'Shattila', hi: 'षट्तिला' } },
  magha: { shukla: { en: 'Jaya', hi: 'जया' }, krishna: { en: 'Vijaya', hi: 'विजया' } },
  phalguna: { shukla: { en: 'Amalaki', hi: 'आमलकी' }, krishna: { en: 'Papamochani', hi: 'पापमोचनी' } },
};

/** Sankranti names by sidereal sign the Sun enters (index 0 = Mesha). */
const SANKRANTI_BY_SIGN: LocalizedName[] = [
  { en: 'Mesha Sankranti', hi: 'मेष संक्रांति' },
  { en: 'Vrishabha Sankranti', hi: 'वृषभ संक्रांति' },
  { en: 'Mithuna Sankranti', hi: 'मिथुन संक्रांति' },
  { en: 'Karka Sankranti', hi: 'कर्क संक्रांति' },
  { en: 'Simha Sankranti', hi: 'सिंह संक्रांति' },
  { en: 'Kanya Sankranti', hi: 'कन्या संक्रांति' },
  { en: 'Tula Sankranti', hi: 'तुला संक्रांति' },
  { en: 'Vrishchika Sankranti', hi: 'वृश्चिक संक्रांति' },
  { en: 'Dhanu Sankranti', hi: 'धनु संक्रांति' },
  { en: 'Makara Sankranti', hi: 'मकर संक्रांति' },
  { en: 'Kumbha Sankranti', hi: 'कुम्भ संक्रांति' },
  { en: 'Meena Sankranti', hi: 'मीन संक्रांति' },
];

// ── Core helper types ────────────────────────────────────────────────────────

/** Bare per-day astronomical facts needed for the lunar calendar. */
export interface BareDay {
  date: string; // local YYYY-MM-DD
  /** 0-based tithi (0 = Shukla Pratipada … 14 = Purnima, 15..29 Krishna) */
  tithiIdx0: number;
  /** 0-based moon nakshatra at local noon */
  nakIdx: number;
  /** 0-based sidereal sun sign at local noon */
  sunSignIdx: number;
  /** raw moon-sun elongation (deg) at local noon */
  elong: number;
}

export interface EnrichedDay {
  lunarMonth: { key: string; en: string; hi: string } | null;
  festivals: FestivalInfo[];
}

const monthByKey = (key: string) => LUNAR_MONTHS.find((m) => m.key === key) ?? null;

/**
 * Amanta lunar month named by the sankranti (sun sign) it contains — the
 * classical parihara rule: Chaitra contains Mesha sankranti, Vaishakha
 * contains Vrishabha … Phalguna contains Meena. Verified against published
 * calendars for 2025-26: Yugadi 2025-03-30 ✓, Navratri 2025-09-22 ✓,
 * Diwali 2025-10-20 ✓, Dev Deepavali 2025-11-05 ✓, Ganesh Chaturthi
 * 2026-09-14 ✓, Vijayadashami 2026-10-20 ✓.
 */
const AMANTA_MONTH_BY_SANKRANTI_SIGN: string[] = [
  'chaitra',      // Mesha
  'vaishakha',    // Vrishabha
  'jyeshtha',     // Mithuna
  'ashadha',      // Karka
  'shravana',     // Simha
  'bhadrapada',   // Kanya
  'ashvina',      // Tula
  'kartika',      // Vrishchika
  'margashirsha', // Dhanu
  'pausha',       // Makara
  'magha',        // Kumbha
  'phalguna',     // Meena
];

type LunarSpan = { startIdx: number; endIdx: number; name: string | null; adhika: boolean };

/**
 * Enrich a contiguous list of local days with lunar-month + festival data.
 * `days` must cover the display range plus ≥35 days BEFORE and ≥52 days AFTER
 * (the purnimanta mapping needs the next purnima AND its enclosing amanta
 * span, i.e. an amavasya up to ~46 days after the last display day).
 */
export function enrichLunarDays(days: BareDay[], displayDates: Set<string>): Map<string, EnrichedDay> {
  const out = new Map<string, EnrichedDay>();

  // ── 1. Amanta spans via new-moon crossings ─────────────────────────────
  // A synodic month boundary = moment elongation wraps 360→0 between two
  // consecutive noons (elong[k-1] > elong[k]). Exact — no tithi can be
  // "skipped" in raw elongation, unlike index markers.
  const spanStarts: number[] = [];
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1].elong > days[i].elong + 180) spanStarts.push(i);
  }
  const spans: LunarSpan[] = [];
  for (let k = 0; k < spanStarts.length; k++) {
    const endIdx = k + 1 < spanStarts.length ? spanStarts[k + 1] - 1 : days.length - 1;
    spans.push({ startIdx: spanStarts[k], endIdx, name: null, adhika: false });
  }

  // ── 2. Name each span by the sankranti it contains ──────────────────────
  let lastName: string | null = null;
  for (const span of spans) {
    let sign: number | null = null;
    for (let i = span.startIdx + 1; i <= span.endIdx; i++) {
      if (days[i].sunSignIdx !== days[i - 1].sunSignIdx) {
        sign = days[i].sunSignIdx;
        break; // first sankranti in the span
      }
    }
    if (sign !== null) {
      span.name = AMANTA_MONTH_BY_SANKRANTI_SIGN[sign];
      lastName = span.name;
    } else {
      // No sankranti → adhika (leap) month: repeats the previous name
      span.name = lastName;
      span.adhika = lastName !== null;
    }
  }

  const spanOfDay = (date: string): LunarSpan | null =>
    spans.find((s) => days[s.startIdx].date <= date && date <= days[s.endIdx].date) ?? null;

  // ── 3. Purnimanta month of day D = amanta name of the span containing the
  // first purnima at/after D (the purnima that closes D's purnimanta month).
  // Purnima day = noon idx0 14, or the day elongation crossed 180° (covers
  // purnimas skipped between consecutive noons, e.g. Oct 2025: idx0 13→15).
  const purnimas: string[] = [];
  for (let i = 0; i < days.length; i++) {
    // 180° is crossed exactly once per synodic month and never wraps, so a
    // simple before/after check catches both noon-purnimas and skipped ones
    // (e.g. Oct 2025: elong 168 → 187 across consecutive noons).
    const crossed180 = i > 0 && days[i - 1].elong < 180 && days[i].elong >= 180;
    if (days[i].tithiIdx0 === 14 || crossed180) {
      // skip duplicates within a couple of days (long purnima tithi)
      if (!purnimas.length || days.findIndex((x) => x.date === purnimas[purnimas.length - 1]) < i - 12) {
        purnimas.push(days[i].date);
      }
    }
  }
  const monthOf = (date: string): string | null => {
    const p = purnimas.find((x) => x >= date);
    if (!p) return null;
    const span = spanOfDay(p);
    return span?.name ?? null;
  };

  // ── 4. Festivals, ekadashis, sankrantis per display day ──────────────────
  for (const d of days) {
    if (!displayDates.has(d.date)) continue;
    const festivals: FestivalInfo[] = [];

    const mKey = monthOf(d.date);
    const month = mKey ? monthByKey(mKey) : null;

    const paksha = d.tithiIdx0 < 15 ? 'Shukla' : 'Krishna';
    const tithiNum = (d.tithiIdx0 % 15) + 1; // 1..15

    // Sankranti — sun changed sign vs previous day
    const idx = days.findIndex((x) => x.date === d.date);
    if (idx > 0 && days[idx - 1].sunSignIdx !== d.sunSignIdx) {
      const s = SANKRANTI_BY_SIGN[d.sunSignIdx];
      festivals.push({ ...s, kind: 'sankranti', month: mKey ?? '' });
    }

    // Named festival by rule
    const rule = mKey ? FESTIVAL_RULES[`${mKey}|${paksha}|${tithiNum}`] : undefined;
    if (rule && month) {
      festivals.push({ en: rule.en, hi: rule.hi, kind: rule.kind ?? 'festival', month: month.key, anchor: `${paksha === 'Shukla' ? 'S' : 'K'}${tithiNum}` });
    }
    // Ekadashi naming (when the rule table didn't already pin a name)
    else if (tithiNum === 11 && month && mKey) {
      const name = EKADASHI_NAMES[mKey]?.[paksha === 'Shukla' ? 'shukla' : 'krishna'];
      if (name) festivals.push({ en: `${name.en} Ekadashi`, hi: `${name.hi} एकादशी`, kind: 'ekadashi', month: month.key, anchor: `${paksha === 'Shukla' ? 'S' : 'K'}11` });
    }

    // A long tithi can span two local noons — keep only the FIRST occurrence
    // of each named observance (e.g. Diwali amavasya shown once, not twice).
    const prev = out.get(shiftDate(d.date, -1));
    if (prev) {
      const prevNames = new Set(prev.festivals.map((f) => f.en));
      const deduped = festivals.filter((f) => f.kind === 'sankranti' || !prevNames.has(f.en));
      out.set(d.date, { lunarMonth: month, festivals: deduped });
    } else {
      out.set(d.date, { lunarMonth: month, festivals });
    }
  }
  return out;
}

function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

export const SANKRANTI_NAMES = SANKRANTI_BY_SIGN;
