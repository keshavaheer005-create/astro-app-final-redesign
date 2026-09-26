// ─── Self Sage · Vedic astrology constants ───────────────────────────────────

export const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

export const SIGNS_HI = [
  'मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या',
  'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुम्भ', 'मीन',
] as const;

export const SIGN_LORDS = [
  'Ma', 'Ve', 'Me', 'Mo', 'Su', 'Me', 'Ve', 'Ma', 'Ju', 'Sa', 'Sa', 'Ju',
] as const;

export type PlanetKey = 'Su' | 'Mo' | 'Ma' | 'Me' | 'Ju' | 'Ve' | 'Sa' | 'Ra' | 'Ke';

export const PLANET_ORDER: PlanetKey[] = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];

export const PLANETS: Record<PlanetKey, { en: string; hi: string; sanskrit: string }> = {
  Su: { en: 'Sun', hi: 'सूर्य', sanskrit: 'Surya' },
  Mo: { en: 'Moon', hi: 'चंद्र', sanskrit: 'Chandra' },
  Ma: { en: 'Mars', hi: 'मंगल', sanskrit: 'Mangala' },
  Me: { en: 'Mercury', hi: 'बुध', sanskrit: 'Budha' },
  Ju: { en: 'Jupiter', hi: 'गुरु', sanskrit: 'Guru' },
  Ve: { en: 'Venus', hi: 'शुक्र', sanskrit: 'Shukra' },
  Sa: { en: 'Saturn', hi: 'शनि', sanskrit: 'Shani' },
  Ra: { en: 'Rahu', hi: 'राहु', sanskrit: 'Rahu' },
  Ke: { en: 'Ketu', hi: 'केतु', sanskrit: 'Ketu' },
};

// Vimshottari dasha years
export const DASHA_YEARS: Record<PlanetKey, number> = {
  Ke: 7, Ve: 20, Su: 6, Mo: 10, Ma: 7, Ra: 18, Ju: 16, Sa: 19, Me: 17,
};
// Vimshottari sequence (starts from the Moon-nakshatra lord)
export const DASHA_SEQUENCE: PlanetKey[] = ['Ke', 'Ve', 'Su', 'Mo', 'Ma', 'Ra', 'Ju', 'Sa', 'Me'];

export const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
] as const;

export const NAKSHATRAS_HI = [
  'अश्विनी', 'भरणी', 'कृत्तिका', 'रोहिणी', 'मृगशिरा', 'आर्द्रा',
  'पुनर्वसु', 'पुष्य', 'अश्लेषा', 'मघा', 'पूर्वा फाल्गुनी', 'उत्तरा फाल्गुनी',
  'हस्त', 'चित्रा', 'स्वाती', 'विशाखा', 'अनुराधा', 'ज्येष्ठा',
  'मूल', 'पूर्वाषाढ़ा', 'उत्तराषाढ़ा', 'श्रवण', 'धनिष्ठा', 'शतभिषा',
  'पूर्वा भाद्रपदा', 'उत्तरा भाद्रपदा', 'रेवती',
] as const;

// Lord of each nakshatra (Vimshottari)
export const NAKSHATRA_LORDS: PlanetKey[] = [
  'Ke', 'Ve', 'Su', 'Mo', 'Ma', 'Ra', 'Ju', 'Sa', 'Me',
  'Ke', 'Ve', 'Su', 'Mo', 'Ma', 'Ra', 'Ju', 'Sa', 'Me',
  'Ke', 'Ve', 'Su', 'Mo', 'Ma', 'Ra', 'Ju', 'Sa', 'Me',
];

export const TITHIS = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi',
  'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi',
  'Trayodashi', 'Chaturdashi', 'Purnima',
] as const;
export const TITHIS_HI = [
  'प्रतिपदा', 'द्वितीया', 'तृतीया', 'चतुर्थी', 'पंचमी', 'षष्ठी',
  'सप्तमी', 'अष्टमी', 'नवमी', 'दशमी', 'एकादशी', 'द्वादशी',
  'त्रयोदशी', 'चतुर्दशी', 'पूर्णिमा',
] as const;

export const YOGAS = [
  'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda',
  'Sukarma', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva',
  'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyana',
  'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla',
  'Brahma', 'Indra', 'Vaidhriti',
] as const;

export const MOVABLE_KARANAS = [
  'Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti',
] as const;

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

// ─── helpers ─────────────────────────────────────────────────────────────────

export const norm360 = (x: number) => ((x % 360) + 360) % 360;

export const signIndex = (lon: number) => Math.floor(norm360(lon) / 30);

export const degInSign = (lon: number) => norm360(lon) % 30;

export const nakshatraIndex = (lon: number) => Math.floor(norm360(lon) / (360 / 27));

export const padaIndex = (lon: number) =>
  Math.floor((norm360(lon) % (360 / 27)) / (360 / 108)) + 1;

export const dms = (deg: number) => {
  const d = Math.floor(deg);
  const mFull = (deg - d) * 60;
  const m = Math.floor(mFull);
  const s = Math.round((mFull - m) * 60);
  return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
};

export const ayanaPadaOf = (lon: number) => nakshatraIndex(lon) * 4 + (padaIndex(lon) - 1);
