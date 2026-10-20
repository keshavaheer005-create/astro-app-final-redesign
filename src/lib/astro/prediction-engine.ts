/**
 * Astrovia's deterministic Vedic-astrology interpretation layer.
 *
 * This is deliberately a rules/evidence engine, not a probability model: it
 * exposes the chart factors that drive a theme so Acharya can explain them,
 * rather than presenting a numerical score as a guaranteed life prediction.
 */
import { NAKSHATRAS, TITHIS, type PlanetKey, nakshatraIndex, norm360, signIndex } from './constants';
import { dignityOf, type Dignity } from './dignity';
import type { ComputedChart } from './chart';
import type { VargaId } from './varga';
import { calcPlanet, juldayFromUTC } from './ephemeris';
import { GOCHARA_BENEFIC } from './horoscope';
import { ymdInZone, zonedToUTC } from '@/lib/tz';

export const PREDICTION_THEMES = {
  career: { houses: [10, 6, 2, 11], primaryHouse: 10, varga: 'D10', dashaFocus: 'career' },
  relationships: { houses: [7, 5, 2, 8], primaryHouse: 7, varga: 'D9', dashaFocus: 'relationships' },
  wealth: { houses: [2, 11, 5, 9], primaryHouse: 2, varga: 'D2', dashaFocus: 'finances' },
  learning: { houses: [4, 5, 9], primaryHouse: 5, varga: 'D24', dashaFocus: 'learning' },
  home: { houses: [2, 4, 9, 12], primaryHouse: 4, varga: 'D12', dashaFocus: 'home' },
  wellbeing: { houses: [1, 6, 8, 12], primaryHouse: 1, varga: 'D30', dashaFocus: 'wellbeing' },
} as const;

export type PredictionThemeId = keyof typeof PREDICTION_THEMES;
export type PredictionTone = 'supportive' | 'mixed' | 'reflective';
export type SignalDirection = 'support' | 'reflect' | 'activation' | 'mixed';

export interface PredictionSignal {
  code: 'dasha_house' | 'dasha_lordship' | 'natal_lord_dignity' | 'transit_aspect' | 'sav_transit_strength' | 'varga_anchor' | 'd9_alignment';
  direction: SignalDirection;
  planet?: PlanetKey;
  house?: number;
  sign?: number;
  bindus?: number;
  dignity?: Dignity;
  varga?: VargaId;
}

export interface ThemeOutlook {
  id: PredictionThemeId;
  tone: PredictionTone;
  houses: number[];
  varga: VargaId;
  activationCount: number;
  signals: PredictionSignal[];
}

export interface PredictiveOutlook {
  asOf: string;
  dasha: { mahaLord: PlanetKey | null; antarLord: PlanetKey | null; mahaEnd: string | null; antarEnd: string | null };
  ashtakavargaApprox: boolean;
  themes: ThemeOutlook[];
  caveat: 'traditional_interpretation_not_certainty';
}

export interface TransitLongitude {
  lon: number;
  retrograde?: boolean;
}

export type TransitSnapshot = Partial<Record<PlanetKey, TransitLongitude>>;

const ASPECT_OFFSETS: Partial<Record<PlanetKey, number[]>> = {
  Ju: [0, 4, 6, 8], // Jupiter: whole-sign 1st, 5th, 7th, 9th
  Sa: [0, 2, 6, 9], // Saturn: whole-sign 1st, 3rd, 7th, 10th
  Ma: [0, 3, 6, 7], // Mars: whole-sign 1st, 4th, 7th, 8th
  Ra: [0, 6],
  Ke: [0, 6],
};

const THEME_KEYWORDS: Record<PredictionThemeId, string[]> = {
  career: ['career', 'job', 'work', 'promotion', 'business', 'interview', 'profession', 'करियर', 'नौकरी', 'काम', 'व्यवसाय', 'प्रमोशन'],
  relationships: ['relationship', 'marriage', 'partner', 'love', 'spouse', 'dating', 'विवाह', 'शादी', 'प्रेम', 'रिश्ता', 'जीवनसाथी'],
  wealth: ['money', 'finance', 'salary', 'wealth', 'income', 'investment', 'debt', 'loan', 'धन', 'पैसा', 'वित्त', 'निवेश', 'कर्ज', 'आय'],
  learning: ['study', 'exam', 'education', 'course', 'learning', 'school', 'college', 'पढ़ाई', 'परीक्षा', 'शिक्षा', 'अध्ययन', 'कॉलेज'],
  home: ['home', 'family', 'property', 'house', 'relocation', 'parents', 'घर', 'परिवार', 'संपत्ति', 'मकान', 'जमीन', 'माता-पिता'],
  wellbeing: ['health', 'wellbeing', 'well-being', 'stress', 'fitness', 'routine', 'healthcare', 'स्वास्थ्य', 'सेहत', 'तनाव', 'फिटनेस'],
};

/** Map free-text intent to an interpretation theme; defaults to general/career-neutral. */
export function classifyDecisionTopic(text: string): PredictionThemeId | 'general' {
  const normalized = text.normalize('NFKC').toLocaleLowerCase();
  let best: PredictionThemeId | 'general' = 'general';
  let bestLength = 0;
  for (const [theme, words] of Object.entries(THEME_KEYWORDS) as [PredictionThemeId, string[]][]) {
    for (const word of words) {
      if (normalized.includes(word.toLocaleLowerCase()) && word.length > bestLength) {
        best = theme;
        bestLength = word.length;
      }
    }
  }
  return best;
}

export function predictionThemeHouses(theme: PredictionThemeId | 'general'): number[] {
  return theme === 'general' ? [1, 5, 9, 10, 11] : [...PREDICTION_THEMES[theme].houses];
}

function activeDasha(chart: ComputedChart, when: Date): { mahaLord: PlanetKey | null; antarLord: PlanetKey | null; mahaEnd: string | null; antarEnd: string | null } {
  const day = when.toISOString().slice(0, 10);
  const maha = (chart.dashas?.mahadashas ?? []).find((entry) => entry.start <= day && entry.end > day);
  if (!maha) return { mahaLord: null, antarLord: null, mahaEnd: null, antarEnd: null };
  const antar = (maha.antardashas ?? []).find((entry) => entry.start <= day && entry.end > day);
  return { mahaLord: maha.lord, antarLord: antar?.lord ?? null, mahaEnd: maha.end, antarEnd: antar?.end ?? null };
}

function toneFromSignals(signals: PredictionSignal[]): PredictionTone {
  const support = signals.filter((signal) => signal.direction === 'support').length;
  const reflect = signals.filter((signal) => signal.direction === 'reflect').length;
  if (support > reflect) return 'supportive';
  if (reflect > support) return 'reflective';
  return 'mixed';
}

function uniqueSignals(signals: PredictionSignal[]): PredictionSignal[] {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = [signal.code, signal.planet ?? '', signal.house ?? '', signal.varga ?? '', signal.sign ?? ''].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Builds a compact evidence-backed outlook from already-computed natal data
 * and current sidereal transits. Does no ephemeris work itself, so callers can
 * share one transit snapshot between the report, API response, and AI context.
 */
export function buildPredictiveOutlook(
  chart: ComputedChart,
  transits: TransitSnapshot,
  when: Date = new Date(),
): PredictiveOutlook {
  const dasha = activeDasha(chart, when);
  const activeLords = [dasha.mahaLord, dasha.antarLord].filter((lord): lord is PlanetKey => lord !== null);
  const themes = (Object.keys(PREDICTION_THEMES) as PredictionThemeId[]).map((id): ThemeOutlook => {
    const definition = PREDICTION_THEMES[id];
    const topicHouses: number[] = [...definition.houses];
    const signals: PredictionSignal[] = [];

    // Current dasha lords activate houses they occupy or rule, but activation
    // by itself is intentionally not labelled fortunate/unfortunate.
    for (const lord of activeLords) {
      const natal = chart.planets.find((planet) => planet.key === lord);
      if (natal && topicHouses.includes(natal.house)) {
        signals.push({ code: 'dasha_house', direction: 'activation', planet: lord, house: natal.house });
      }
      const ruledHouses = (chart.houses ?? []).filter((house) => topicHouses.includes(house.index) && house.lord === lord).map((house) => house.index);
      if (ruledHouses.length) {
        signals.push({ code: 'dasha_lordship', direction: 'activation', planet: lord, house: ruledHouses[0] });
      }
    }

    // Strength of the primary life-area lord by sign dignity. This is a
    // traditional rule and only one factor among many, never a verdict alone.
    const primaryHouse = (chart.houses ?? []).find((house) => house.index === definition.primaryHouse);
    if (primaryHouse) {
      const lordPlacement = (chart.planets ?? []).find((planet) => planet.key === primaryHouse.lord);
      const dignity = lordPlacement ? dignityOf(primaryHouse.lord, lordPlacement.sign) : null;
      if (dignity) {
        const direction: SignalDirection = ['exalted', 'own', 'friendly'].includes(dignity)
          ? 'support'
          : ['debilitated', 'enemy'].includes(dignity) ? 'reflect' : 'mixed';
        signals.push({ code: 'natal_lord_dignity', direction, planet: primaryHouse.lord, house: definition.primaryHouse, dignity });
      }
      const varga = chart.divisionalCharts?.[definition.varga];
      if (varga && lordPlacement && typeof varga.planets[primaryHouse.lord] === 'number') {
        signals.push({ code: 'varga_anchor', direction: 'activation', planet: primaryHouse.lord, house: definition.primaryHouse, varga: definition.varga, sign: varga.planets[primaryHouse.lord] });
        if (definition.varga === 'D9' && lordPlacement.sign === varga.planets[primaryHouse.lord]) {
          signals.push({ code: 'd9_alignment', direction: 'activation', planet: primaryHouse.lord, house: definition.primaryHouse, varga: 'D9', sign: lordPlacement.sign });
        }
      }
    }

    // Slow/current graha contacts to theme houses. Whole-sign drishti offsets
    // are explicit so the AI can show why each signal was emitted.
    const relevantTransitKeys: PlanetKey[] = ['Ju', 'Sa', 'Ma', 'Ra', 'Ke'];
    for (const planetKey of relevantTransitKeys) {
      const transit = transits[planetKey];
      if (!transit || !Number.isFinite(transit.lon)) continue;
      const transitSign = signIndex(transit.lon);
      const offsets = ASPECT_OFFSETS[planetKey] ?? [];
      const targetHouse = topicHouses.find((houseNo) => {
        const targetSign = chart.houses?.[houseNo - 1]?.sign;
        if (typeof targetSign !== 'number') return false;
        return offsets.includes((targetSign - transitSign + 12) % 12);
      });
      if (targetHouse === undefined) continue;
      const direction: SignalDirection = planetKey === 'Ju' ? 'support' : planetKey === 'Sa' || planetKey === 'Ma' ? 'reflect' : 'mixed';
      signals.push({ code: 'transit_aspect', direction, planet: planetKey, house: targetHouse, sign: transitSign });

      // SAV is useful for traditional gochara interpretation, but do not
      // pretend the fallback approximation is classical chart-specific data.
      if (chart.ashtakavargaApprox === false && chart.ashtakavarga?.sav && (planetKey === 'Ju' || planetKey === 'Sa')) {
        const bindus = chart.ashtakavarga.sav[transitSign];
        signals.push({
          code: 'sav_transit_strength',
          direction: bindus >= 29 ? 'support' : bindus < 25 ? 'reflect' : 'mixed',
          planet: planetKey,
          house: targetHouse,
          sign: transitSign,
          bindus,
        });
      }
    }

    // Keep the payload small and stable. Dasha activation is not a tone vote.
    const trimmed = uniqueSignals(signals).slice(0, 7);
    const tone = toneFromSignals(trimmed);
    return {
      id,
      tone,
      houses: [...topicHouses],
      varga: definition.varga,
      activationCount: trimmed.filter((signal) => signal.direction === 'activation').length,
      signals: trimmed,
    };
  });

  return {
    asOf: when.toISOString(),
    dasha,
    ashtakavargaApprox: chart.ashtakavargaApprox !== false || !chart.ashtakavarga?.sav,
    themes,
    caveat: 'traditional_interpretation_not_certainty',
  };
}

/** Small chart-grounded excerpt for Acharya prompts; avoids sending a huge new context block. */
export function predictiveContextLine(outlook: PredictiveOutlook): string {
  const summary = outlook.themes.map((theme) => {
    const evidence = theme.signals.slice(0, 3).map((signal) => {
      if (signal.code === 'dasha_house') return `${signal.planet} dasha lord occupies theme house ${signal.house}`;
      if (signal.code === 'dasha_lordship') return `${signal.planet} rules theme house ${signal.house}`;
      if (signal.code === 'natal_lord_dignity') return `${signal.planet} as primary house lord is ${signal.dignity}`;
      if (signal.code === 'transit_aspect') return `${signal.planet} transit contacts theme house ${signal.house}`;
      if (signal.code === 'sav_transit_strength') return `${signal.planet} transit has ${signal.bindus} SAV bindus`;
      if (signal.code === 'd9_alignment') return `${signal.planet} is D1/D9 sign-aligned`;
      if (signal.code === 'varga_anchor') return `${signal.planet} in ${signal.varga} sign ${signal.sign}`;
      return signal.code;
    });
    return `${theme.id}: ${theme.tone}${evidence.length ? ` (${evidence.join('; ')})` : ''}`;
  });
  return `Traditional predictive context (themes are interpretive emphasis, not certainty): ${summary.join(' | ')}. ${outlook.ashtakavargaApprox ? 'Ashtakavarga table is approximate; do not rely on its bindus.' : 'SAV values use the chart-specific classical table.'}`;
}


const AVOID_TITHI_INDEX = new Set([3, 8, 13]);
const AVOID_NAKSHATRAS = new Set(['Ardra', 'Ashlesha', 'Magha', 'Jyeshtha', 'Mula', 'Shatabhisha', 'Krittika']);
const GOOD_NAKSHATRAS = new Set(['Pushya', 'Hasta', 'Anuradha', 'Shravana', 'Dhanishta', 'Revati', 'Punarvasu', 'Swati', 'Chitra', 'Uttara Phalguni']);

export interface DecisionWindow {
  date: string;
  /** Relative traditional-rule fit used only to rank days within this scan. */
  fit: number;
  factors: string[];
}

function shiftDateKey(day: string, offset: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + offset, 12)).toISOString().slice(0, 10);
}

/**
 * Scan local calendar days for topic-specific relative windows. A date is
 * sampled at local noon: the output is day-level guidance, not an exact muhurta.
 * The caller should memoize this function because 2 ephemeris positions are
 * calculated per day.
 */
export function findDecisionWindows(
  chart: ComputedChart,
  topic: PredictionThemeId | 'general',
  from: Date,
  timezone: string,
  days = 21,
): DecisionWindow[] {
  const today = ymdInZone(timezone, from);
  const natalMoonSign = chart.moonSign.index;
  const targetHouses = predictionThemeHouses(topic);
  const candidates: DecisionWindow[] = [];

  for (let offset = 1; offset <= Math.max(1, Math.min(35, Math.floor(days))); offset++) {
    const date = shiftDateKey(today, offset);
    const [year, month, day] = date.split('-').map(Number);
    const sample = zonedToUTC(year, month, day, 12, 0, timezone);
    const jd = juldayFromUTC(sample);
    let moonLon: number;
    let sunLon: number;
    try {
      moonLon = calcPlanet('Mo', jd, true).lon;
      sunLon = calcPlanet('Su', jd, true).lon;
    } catch {
      // Ephemeris failure should not turn into made-up windows.
      return [];
    }

    const moonSign = signIndex(moonLon);
    const moonHouseFromAsc = ((moonSign - chart.ascendant.sign + 12) % 12) + 1;
    const moonHouseFromNatalMoon = ((moonSign - natalMoonSign + 12) % 12) + 1;
    const elongation = norm360(moonLon - sunLon);
    const tithiOrdinal = Math.floor(elongation / 12);
    const tithiWithinPaksha = tithiOrdinal % 15;
    const nakIndex = nakshatraIndex(moonLon);
    const nakshatra = NAKSHATRAS[nakIndex];
    const fitFactors: string[] = [];
    let fit = 0;

    if (GOCHARA_BENEFIC.Mo.includes(moonHouseFromNatalMoon)) {
      fit += 1;
      fitFactors.push(`Moon is ${moonHouseFromNatalMoon}th from natal Moon`);
    } else {
      fit -= 1;
    }
    if (targetHouses.includes(moonHouseFromAsc)) {
      fit += 1;
      fitFactors.push(`Moon transit touches topic house ${moonHouseFromAsc}`);
    }
    if (GOOD_NAKSHATRAS.has(nakshatra)) {
      fit += 1;
      fitFactors.push(`${nakshatra} is in the configured supportive-nakshatra set`);
    } else if (AVOID_NAKSHATRAS.has(nakshatra)) {
      fit -= 1;
      fitFactors.push(`${nakshatra} is traditionally treated as more reflective`);
    }
    if (AVOID_TITHI_INDEX.has(tithiWithinPaksha)) {
      fit -= 1;
      fitFactors.push(`${TITHIS[tithiWithinPaksha]} is in the configured rikta-tithi set`);
    }
    if (chart.ashtakavargaApprox === false && chart.ashtakavarga?.sav) {
      const bindus = chart.ashtakavarga.sav[moonSign];
      if (bindus >= 29) {
        fit += 1;
        fitFactors.push(`Moon sign has ${bindus} SAV bindus`);
      } else if (bindus < 25) {
        fit -= 1;
        fitFactors.push(`Moon sign has ${bindus} SAV bindus`);
      }
    }
    candidates.push({ date, fit, factors: fitFactors });
  }

  // Return the strongest distinct dates, rather than simply the first three
  // hits (which tended to favour whichever fortnight was scanned first).
  const ranked = [...candidates].sort((a, b) => b.fit - a.fit || a.date.localeCompare(b.date));
  const selected: DecisionWindow[] = [];
  for (const candidate of ranked) {
    if (selected.every((prior) => Math.abs((Date.parse(`${prior.date}T00:00:00Z`) - Date.parse(`${candidate.date}T00:00:00Z`)) / 86400000) >= 2)) {
      selected.push(candidate);
      if (selected.length === 3) break;
    }
  }
  if (selected.length < 3) {
    for (const candidate of ranked) {
      if (selected.some((prior) => prior.date === candidate.date)) continue;
      selected.push(candidate);
      if (selected.length === 3) break;
    }
  }
  return selected.sort((a, b) => a.date.localeCompare(b.date));
}
