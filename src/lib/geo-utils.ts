/**
 * Pure helpers behind /api/geocode. No network, no state — easy to test.
 *
 * Villages are where generic geocoders fail: the same place is written
 * "Narel Khera", "Narelkhera", "Narel Kheda"… and users add the state or
 * district ("Narel Khera in Haryana"). These helpers understand that.
 */

/** Lowercase, strip diacritics, keep only latin letters / digits / Devanagari. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0900-\u097F]/g, '');
}

/* ── Indian states & UTs (normalized key → display name) ─────────────────── */

const STATE_LIST: { name: string; keys: string[]; abbr?: string[] }[] = [
  { name: 'Andhra Pradesh', keys: ['andhrapradesh', 'आंध्रप्रदेश'], abbr: ['ap'] },
  { name: 'Arunachal Pradesh', keys: ['arunachalpradesh', 'अरुणाचलप्रदेश'] },
  { name: 'Assam', keys: ['assam', 'असम'] },
  { name: 'Bihar', keys: ['bihar', 'बिहार'] },
  { name: 'Chhattisgarh', keys: ['chhattisgarh', 'chattisgarh', 'chhattisgard', 'छत्तीसगढ', 'छत्तीसगढ़'] },
  { name: 'Goa', keys: ['goa', 'गोवा'] },
  { name: 'Gujarat', keys: ['gujarat', 'गुजरात'] },
  { name: 'Haryana', keys: ['haryana', 'hariyana', 'हरियाणा'], abbr: ['hr'] },
  { name: 'Himachal Pradesh', keys: ['himachalpradesh', 'हिमाचलप्रदेश'], abbr: ['hp'] },
  { name: 'Jharkhand', keys: ['jharkhand', 'झारखंड', 'झारखण्ड'] },
  { name: 'Karnataka', keys: ['karnataka', 'कर्नाटक'] },
  { name: 'Kerala', keys: ['kerala', 'केरल'] },
  { name: 'Madhya Pradesh', keys: ['madhyapradesh', 'मध्यप्रदेश'], abbr: ['mp'] },
  { name: 'Maharashtra', keys: ['maharashtra', 'महाराष्ट्र'] },
  { name: 'Manipur', keys: ['manipur', 'मणिपुर'] },
  { name: 'Meghalaya', keys: ['meghalaya', 'मेघालय'] },
  { name: 'Mizoram', keys: ['mizoram', 'मिजोरम'] },
  { name: 'Nagaland', keys: ['nagaland', 'नागालैंड'] },
  { name: 'Odisha', keys: ['odisha', 'orissa', 'ओडिशा', 'उड़ीसा'] },
  { name: 'Punjab', keys: ['punjab', 'panjab', 'पंजाब'], abbr: ['pb'] },
  { name: 'Rajasthan', keys: ['rajasthan', 'राजस्थान'], abbr: ['rj'] },
  { name: 'Sikkim', keys: ['sikkim', 'सिक्किम'] },
  { name: 'Tamil Nadu', keys: ['tamilnadu', 'तमिलनाडु'], abbr: ['tn'] },
  { name: 'Telangana', keys: ['telangana', 'तेलंगाना'] },
  { name: 'Tripura', keys: ['tripura', 'त्रिपुरा'] },
  { name: 'Uttar Pradesh', keys: ['uttarpradesh', 'उत्तरप्रदेश'], abbr: ['up'] },
  { name: 'Uttarakhand', keys: ['uttarakhand', 'uttaranchal', 'उत्तराखंड', 'उत्तराखण्ड'] },
  { name: 'West Bengal', keys: ['westbengal', 'पश्चिमबंगाल'], abbr: ['wb'] },
  { name: 'Delhi', keys: ['delhi', 'newdelhi', 'दिल्ली', 'नईदिल्ली'] },
  { name: 'Chandigarh', keys: ['chandigarh', 'चंडीगढ़', 'चंडीगढ'] },
  { name: 'Jammu and Kashmir', keys: ['jammuandkashmir', 'jammukashmir', 'जम्मूकश्मीर'], abbr: ['jk'] },
  { name: 'Ladakh', keys: ['ladakh', 'लद्दाख'] },
  { name: 'Puducherry', keys: ['puducherry', 'pondicherry', 'पुडुचेरी'] },
];

const STATE_BY_KEY = new Map<string, string>();
const STATE_BY_ABBR = new Map<string, string>();
for (const s of STATE_LIST) {
  for (const k of s.keys) STATE_BY_KEY.set(k, s.name);
  for (const a of s.abbr ?? []) STATE_BY_ABBR.set(a, s.name);
}

const COUNTRY_WORDS = new Set(['india', 'bharat', 'भारत', 'hindustan']);
const CONNECTORS = new Set(['in', 'of', 'at', 'near', 'from', 'ke', 'ka', 'ki', 'के', 'का', 'की', 'में', 'पास']);
const NOISE_WORDS = new Set([
  'village', 'vill', 'vpo', 'po', 'ps', 'teh', 'tehsil', 'tahsil', 'dist', 'district', 'gaon', 'gram', 'town', 'city',
  'ग्राम', 'गाँव', 'गांव', 'जिला', 'तहसील', 'शहर',
]);

export interface ParsedQuery {
  /** What the user most likely means as the place name (noise words and region removed). */
  core: string;
  /** Indian state / UT if the user mentioned one (display name). */
  region?: string;
  /** Other comma-separated hints (district etc.), original spelling. */
  extra: string[];
  /** Looks like an Indian place (state / "India" mentioned, or Devanagari). */
  indiaContext: boolean;
}

export function parseQuery(raw: string): ParsedQuery {
  const original = raw.trim().replace(/\s+/g, ' ');
  let region: string | undefined;
  let indiaContext = /[\u0900-\u097F]/.test(original);
  const extra: string[] = [];

  const stripWords = (text: string): string => {
    const words = text.split(' ').filter(Boolean);
    const kept = words.filter((w) => !NOISE_WORDS.has(norm(w)) && !NOISE_WORDS.has(w.toLowerCase()));
    return (kept.length ? kept : words).join(' ');
  };

  const segments = original.split(',').map((s) => s.trim()).filter(Boolean);
  let placeText = segments[0] ?? original;

  if (segments.length > 1) {
    for (const seg of segments.slice(1)) {
      const k = norm(seg);
      if (STATE_BY_KEY.has(k)) region = STATE_BY_KEY.get(k);
      else if (STATE_BY_ABBR.has(k)) region = STATE_BY_ABBR.get(k);
      else if (COUNTRY_WORDS.has(k)) indiaContext = true;
      else extra.push(seg);
    }
  }

  // "Narel Khera in Haryana" / "Narel Khera Haryana" — trailing state words without commas
  if (!region) {
    const words = placeText.split(' ');
    for (let take = Math.min(3, words.length - 1); take >= 1; take--) {
      const tail = words.slice(-take).join('');
      const key = norm(tail);
      const state = STATE_BY_KEY.get(key);
      if (state) {
        region = state;
        let head = words.slice(0, -take);
        while (head.length > 1 && CONNECTORS.has(norm(head[head.length - 1]))) head = head.slice(0, -1);
        placeText = head.join(' ');
        break;
      }
    }
  }
  // trailing "india"
  {
    const words = placeText.split(' ');
    if (words.length > 1 && COUNTRY_WORDS.has(norm(words[words.length - 1]))) {
      indiaContext = true;
      placeText = words.slice(0, -1).join(' ');
    }
  }
  if (region) indiaContext = true;

  const core = stripWords(placeText) || original;
  return { core, region, extra, indiaContext };
}

/* ── Spelling variants (Indian village naming) ───────────────────────────── */

// Word endings that are interchangeable in transliterations of Indian place names.
const SUFFIX_FAMILIES: string[][] = [
  ['khera', 'kheda', 'kehra', 'khedi', 'kheri', 'khedaa'],
  ['pur', 'pura', 'puri', 'poor'],
  ['garh', 'gadh', 'gar', 'ghar'],
  ['wala', 'wali', 'vala', 'walla', 'wal'],
  ['nagar', 'nagr', 'nager'],
  ['abad', 'aabad', 'abaad'],
  ['ganj', 'gunj', 'ganj'],
  ['kalan', 'kalaan', 'kala', 'kalam'],
  ['khurd', 'khurad', 'khord'],
  ['gaon', 'gaoun', 'gam', 'gav'],
  ['pind', 'pindi'],
  ['majra', 'majara', 'majre'],
  ['mandi', 'mundi'],
];
const SUFFIX_LONGEST_FIRST = SUFFIX_FAMILIES.flat().sort((a, b) => b.length - a.length);

/** "narelkhera" → "narel khera" (only when a known village suffix ends the word). */
export function splitCompound(word: string): string | null {
  const w = word.toLowerCase();
  if (w.includes(' ')) return null;
  for (const suf of SUFFIX_LONGEST_FIRST) {
    if (suf.length >= 3 && w.length >= suf.length + 3 && w.endsWith(suf)) {
      return `${w.slice(0, -suf.length)} ${suf}`;
    }
  }
  return null;
}

function foldSpelling(s: string): string {
  return s
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/(.)\1+/g, '$1') // double letters → single
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k');
}

/**
 * Up to `max` alternative spellings of a place name, most promising first.
 * Never includes the input itself.
 */
export function spellingVariants(core: string, max = 4): string[] {
  const base = core.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  if (!base || /[\u0900-\u097F]/.test(base)) return [];
  const out = new Set<string>();
  const add = (v: string | null | undefined) => {
    const t = (v ?? '').replace(/\s+/g, ' ').trim();
    if (t && t !== base && t.length >= 3) out.add(t);
  };

  // 1. glue / split
  add(base.replace(/ /g, ''));
  add(splitCompound(base.replace(/ /g, '')));

  // 2. swap the village-suffix word for its siblings
  const words = base.split(' ');
  const last = words[words.length - 1];
  for (const fam of SUFFIX_FAMILIES) {
    if (fam.includes(last)) {
      for (const alt of fam) if (alt !== last) add([...words.slice(0, -1), alt].join(' '));
    }
  }
  // glued form with a suffix family ("narelkhera" → "narelkheda")
  const glued = base.replace(/ /g, '');
  for (const fam of SUFFIX_FAMILIES) {
    for (const suf of fam) {
      if (glued.endsWith(suf) && glued.length > suf.length + 2) {
        for (const alt of fam) if (alt !== suf) add(`${glued.slice(0, -suf.length)} ${alt}`);
        break;
      }
    }
  }

  // 3. spelling folds
  add(foldSpelling(base));
  // 4. common vowel endings: "narela" ↔ "narel"
  if (words.length === 1) {
    if (base.endsWith('a') && base.length > 4) add(base.slice(0, -1));
    else add(`${base}a`);
  }
  return [...out].slice(0, max);
}

/* ── Phonetic key + similarity ───────────────────────────────────────────── */

/** Rough consonant skeleton of an Indian place name ("Khera" ≈ "Kehra" ≈ "Kheraa"). */
export function phoneKey(s: string): string {
  let t = norm(s);
  if (!t || /[\u0900-\u097F]/.test(t)) return t;
  t = t
    .replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/ch/g, 'c').replace(/jh/g, 'j')
    .replace(/th/g, 't').replace(/dh/g, 'd').replace(/bh/g, 'b').replace(/ph/g, 'f')
    .replace(/sh/g, 's').replace(/w/g, 'v').replace(/z/g, 'j').replace(/q/g, 'k').replace(/x/g, 'ks')
    .replace(/c/g, 'k').replace(/y/g, 'i');
  t = t.replace(/(.)\1+/g, '$1');
  // keep the first letter, drop the other vowels and h
  return t[0] + t.slice(1).replace(/[aeiouh]/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1 — how alike two place names sound/look (spacing and diacritics ignored). */
export function similarity(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const direct = 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
  const ka = phoneKey(a);
  const kb = phoneKey(b);
  const phon = ka && kb ? 1 - levenshtein(ka, kb) / Math.max(ka.length, kb.length) : 0;
  return Math.max(direct, phon * 0.95);
}

/* ── Coordinates typed or pasted by the user ─────────────────────────────── */

/**
 * "29.1753, 74.2" · "29.1753 N 74.2 E" · "@29.17,74.20" (Google Maps) ·
 * "https://www.google.com/maps/place/.../@29.17,74.20,15z". Returns null otherwise.
 */
export function parseCoords(raw: string): { lat: number; lng: number } | null {
  const s = raw.trim();
  const at = s.match(/@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/);
  const plain = s.match(/^\(?\s*(-?\d{1,2}(?:\.\d+)?)\s*°?\s*([NSns])?\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([EWew])?\s*\)?$/);
  let lat: number;
  let lng: number;
  if (at) {
    lat = parseFloat(at[1]);
    lng = parseFloat(at[2]);
  } else if (plain) {
    lat = parseFloat(plain[1]);
    lng = parseFloat(plain[3]);
    if (plain[2] && /s/i.test(plain[2])) lat = -Math.abs(lat);
    if (plain[4] && /w/i.test(plain[4])) lng = -Math.abs(lng);
  } else {
    return null;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
