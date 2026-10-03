import { NextResponse } from 'next/server';
import tzLookup from 'tz-lookup';

export const runtime = 'nodejs';

interface GeoCity {
  name: string;
  lat: number;
  lng: number;
  timezone: string;
  country?: string;
  admin?: string;
  population?: number;
  osmValue?: string;
  source: 'open-meteo' | 'photon' | 'nominatim' | 'bundled' | 'reverse';
}

interface RawHit {
  name: string;
  lat: number;
  lng: number;
  timezone?: string; // when absent, resolved via offline tz-lookup
  country?: string;
  countryCode?: string;
  admin?: string;
  population?: number;
  osmValue?: string; // Photon place class (city/town/village…) for settlement tiering
  source: GeoCity['source'];
}

/** Bundled fallback (offline resilience): major cities with correct timezones */
const FALLBACK_CITIES: GeoCity[] = ([
  { name: 'Mumbai', lat: 19.076, lng: 72.8777, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Delhi', lat: 28.6139, lng: 77.209, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'New Delhi', lat: 28.6139, lng: 77.209, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Hyderabad', lat: 17.385, lng: 78.4867, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Pune', lat: 18.5204, lng: 73.8567, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Lucknow', lat: 26.8467, lng: 80.9462, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Varanasi', lat: 25.3176, lng: 82.9739, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Ujjain', lat: 23.1765, lng: 75.7885, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Nashik', lat: 19.9975, lng: 73.7898, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Nagpur', lat: 21.1458, lng: 79.0882, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Indore', lat: 22.7196, lng: 75.8577, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Bhopal', lat: 23.2599, lng: 77.4126, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Patna', lat: 25.5941, lng: 85.1376, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Surat', lat: 21.1702, lng: 72.8311, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Kanpur', lat: 26.4499, lng: 80.3319, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Coimbatore', lat: 11.0168, lng: 76.9558, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Kochi', lat: 9.9312, lng: 76.2673, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Guwahati', lat: 26.1445, lng: 91.7362, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Chandigarh', lat: 30.7333, lng: 76.7794, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Amritsar', lat: 31.634, lng: 74.8723, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Dehradun', lat: 30.3165, lng: 78.0322, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Haridwar', lat: 29.9457, lng: 78.1642, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Tirupati', lat: 13.6288, lng: 79.4192, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Madurai', lat: 9.9252, lng: 78.1198, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Ranchi', lat: 23.3441, lng: 85.3096, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Raipur', lat: 21.2514, lng: 81.6296, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Bhubaneswar', lat: 20.2961, lng: 85.8245, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Vadodara', lat: 22.3072, lng: 73.1812, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Ludhiana', lat: 30.901, lng: 75.8573, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Agra', lat: 27.1767, lng: 78.0081, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Mathura', lat: 27.4924, lng: 77.6737, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Ayodhya', lat: 26.7922, lng: 82.1998, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Srinagar', lat: 34.0837, lng: 74.7973, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Kotdwara', lat: 29.7461, lng: 78.5222, timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'London', lat: 51.5072, lng: -0.1276, timezone: 'Europe/London', country: 'United Kingdom' },
  { name: 'Manchester', lat: 53.4808, lng: -2.2426, timezone: 'Europe/London', country: 'United Kingdom' },
  { name: 'New York', lat: 40.7128, lng: -74.006, timezone: 'America/New_York', country: 'United States' },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194, timezone: 'America/Los_Angeles', country: 'United States' },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298, timezone: 'America/Chicago', country: 'United States' },
  { name: 'Houston', lat: 29.7604, lng: -95.3698, timezone: 'America/Chicago', country: 'United States' },
  { name: 'Toronto', lat: 43.6532, lng: -79.3832, timezone: 'America/Toronto', country: 'Canada' },
  { name: 'Vancouver', lat: 49.2827, lng: -123.1207, timezone: 'America/Vancouver', country: 'Canada' },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708, timezone: 'Asia/Dubai', country: 'UAE' },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198, timezone: 'Asia/Singapore', country: 'Singapore' },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093, timezone: 'Australia/Sydney', country: 'Australia' },
  { name: 'Melbourne', lat: -37.8136, lng: 144.9631, timezone: 'Australia/Melbourne', country: 'Australia' },
  { name: 'Auckland', lat: -36.8485, lng: 174.7633, timezone: 'Pacific/Auckland', country: 'New Zealand' },
  { name: 'Kathmandu', lat: 27.7172, lng: 85.324, timezone: 'Asia/Kathmandu', country: 'Nepal' },
  { name: 'Colombo', lat: 6.9271, lng: 79.8612, timezone: 'Asia/Colombo', country: 'Sri Lanka' },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, timezone: 'Asia/Tokyo', country: 'Japan' },
  { name: 'Paris', lat: 48.8566, lng: 2.3522, timezone: 'Europe/Paris', country: 'France' },
  { name: 'Berlin', lat: 52.52, lng: 13.405, timezone: 'Europe/Berlin', country: 'Germany' },
  { name: 'Johannesburg', lat: -26.2041, lng: 28.0473, timezone: 'Africa/Johannesburg', country: 'South Africa' },
  { name: 'Nairobi', lat: -1.2921, lng: 36.8219, timezone: 'Africa/Nairobi', country: 'Kenya' },
  { name: 'Kuala Lumpur', lat: 3.139, lng: 101.6869, timezone: 'Asia/Kuala_Lumpur', country: 'Malaysia' },
  { name: 'Hong Kong', lat: 22.3193, lng: 114.1694, timezone: 'Asia/Hong_Kong', country: 'Hong Kong' },
  { name: 'Moscow', lat: 55.7558, lng: 37.6173, timezone: 'Europe/Moscow', country: 'Russia' },
  { name: 'Sao Paulo', lat: -23.5505, lng: -46.6333, timezone: 'America/Sao_Paulo', country: 'Brazil' },
] as Omit<GeoCity, 'source'>[]).map((c) => ({ ...c, source: 'bundled' as const }));

const PROVIDER_TIMEOUT_MS = 3500;

/** Lowercase + strip diacritics for comparison */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0900-\u097F]/g, '');
}

/**
 * Historic / vernacular / Hindi aliases → canonical city name.
 * Makes "Benares", "बनारस", "Kashi", "काशी" all rank *Varanasi (India)* first,
 * "Calcutta" → Kolkata, "Bombay" → Mumbai, "Trivandrum" → Thiruvananthapuram, etc.
 * Keys and canonical values are normalized (diacritics stripped, lowercase).
 */
const ALIASES: Record<string, string> = {
  // Varanasi
  benares: 'varanasi',
  banaras: 'varanasi',
  kashi: 'varanasi',
  काशी: 'varanasi',
  काशिका: 'varanasi',
  बनारस: 'varanasi',
  वाराणसी: 'varanasi',
  // Other Indian megacities (historic English + Hindi names)
  calcutta: 'kolkata',
  कोलकाता: 'kolkata',
  कलकत्ता: 'kolkata',
  bombay: 'mumbai',
  मुंबई: 'mumbai',
  मुम्बई: 'mumbai',
  madras: 'chennai',
  चेन्नई: 'chennai',
  bangalore: 'bengaluru',
  bengalooru: 'bengaluru',
  बैंगलोर: 'bengaluru',
  बेंगलुरु: 'bengaluru',
  trivandrum: 'thiruvananthapuram',
  cochin: 'kochi',
  कोचीन: 'kochi',
  कोच्चि: 'kochi',
  mysore: 'mysuru',
  मैसूर: 'mysuru',
  gurgaon: 'gurugram',
  गुडगाँव: 'gurugram',
  allahabad: 'prayagraj',
  इलाहाबाद: 'prayagraj',
  प्रयागराज: 'prayagraj',
  poona: 'pune',
  पुणे: 'pune',
  baroda: 'vadodara',
  वडोदरा: 'vadodara',
  pondicherry: 'puducherry',
  पांडिचेरी: 'puducherry',
  pondicheri: 'puducherry',
  // More Hindi metros so Hindi-native results match Latin canonicals
  दिल्ली: 'delhi',
  नईदिल्ली: 'delhi',
  हैदराबाद: 'hyderabad',
  जयपुर: 'jaipur',
  लखनऊ: 'lucknow',
  अहमदाबाद: 'ahmedabad',
  सूरत: 'surat',
  कानपुर: 'kanpur',
  नागपुर: 'nagpur',
  भोपाल: 'bhopal',
  पटना: 'patna',
  गोवा: 'goa',
};

function canonical(name: string): string {
  const n = norm(name);
  return ALIASES[n] ?? n;
}

/** Comparable population strength across providers (0–10 log scale). */
const PHOTON_TIER: Record<string, number> = {
  city: 4.6,
  municipality: 4.0,
  town: 3.6,
  borough: 3.2,
  village: 2.8,
  suburb: 2.6,
  hamlet: 2.4,
};
function popStrength(c: GeoCity): number {
  if (typeof c.population === 'number') {
    if (c.population > 1000) return Math.min(10, Math.log10(c.population)) + 1; // real pop (Open-Meteo) + decisiveness bonus
    if (c.population === 1) return 3.5; // Photon settlement marker
    if (c.population > 0) return Math.min(7, Math.pow(c.population / 100, 1.5) * 7); // Nominatim importance ×100 → capped at 7
  }
  if (c.source === 'photon' && c.osmValue) return PHOTON_TIER[c.osmValue] ?? 3.0; // Photon settlement class
  return 0;
}

/** Match quality: 5 exact (raw or canonical) · 3 prefix · 2 contains · 0 none */
function matchScore(name: string, qRaw: string, qCanon: string): number {
  const n = norm(name);
  const c = canonical(name);
  if (n === qRaw || c === qCanon) return 5;
  if (n.startsWith(qRaw) || c.startsWith(qCanon)) return 3;
  if (n.includes(qRaw) || c.includes(qCanon)) return 2;
  return 0;
}

function approxSamePlace(a: { lat: number; lng: number }, b: { lat: number; lng: number }): boolean {
  // ~0.3° ≈ 33 km — near-certain duplicate for settlement-level geocoding
  return Math.abs(a.lat - b.lat) < 0.3 && Math.abs(a.lng - b.lng) < 0.3;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── Provider: Open-Meteo (fast, timezone + population built in) ─────────── */
async function openMeteo(q: string, language: string): Promise<RawHit[]> {
  const data = (await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=${language}&format=json`,
  )) as { results?: Array<{ name: string; latitude: number; longitude: number; timezone?: string; country?: string; country_code?: string; admin1?: string; population?: number }> };
  return (data.results ?? []).map((r) => ({
    name: r.name,
    lat: r.latitude,
    lng: r.longitude,
    timezone: r.timezone,
    country: r.country,
    countryCode: r.country_code,
    admin: r.admin1,
    population: r.population,
    source: 'open-meteo' as const,
  }));
}

const NOMINATIM_UA = 'Astrovia/1.0 (vedic astrology birth chart app)';

/* ── Provider: Photon (OSM fuzzy matching, alternate + native names) ─────── */
interface PhotonFeature {
  properties?: {
    name?: string;
    country?: string;
    countrycode?: string;
    state?: string;
    city?: string;
    county?: string;
    osm_value?: string;
    extent?: number[];
  };
  geometry?: { coordinates?: [number, number] };
}
async function photon(q: string, language: string): Promise<RawHit[]> {
  const data = (await fetchJson(
    `https://photon.komoot.io/api?q=${encodeURIComponent(q)}&limit=8&lang=${language === 'hi' ? 'default' : language}`,
  )) as { features?: PhotonFeature[] };
  return (data.features ?? [])
    .filter((f) => f.geometry?.coordinates && f.properties?.name)
    .map((f) => {
      const [lng, lat] = f.geometry!.coordinates!;
      const p = f.properties!;
      const baseName: string = p.name!; // guaranteed non-empty by the filter above
      return {
        name: p.city || baseName,
        lat,
        lng,
        country: p.country,
        countryCode: p.countrycode,
        admin: p.state || p.county,
        source: 'photon' as const,
        osmValue: p.osm_value,
      };
    });
}

/* ── Provider: Nominatim (deepest OSM coverage, vernacular names) ────────── */
interface NominatimHit {
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string>;
  importance?: number;
  type?: string;
}
async function nominatim(q: string, language: string): Promise<RawHit[]> {
  const data = (await fetchJson(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=8&accept-language=${language}&addressdetails=1`,
    { headers: { 'User-Agent': 'Astrovia/1.0 (vedic astrology birth chart app)' } },
  )) as NominatimHit[];
  return (data ?? [])
    .filter((r) => r.lat && r.lon)
    .map((r) => {
      const display = (r.display_name ?? '').split(',').map((s) => s.trim());
      return {
        name: r.name || r.address?.city || r.address?.town || r.address?.village || display[0] || '',
        lat: parseFloat(r.lat!),
        lng: parseFloat(r.lon!),
        country: r.address?.country,
        countryCode: r.address?.country_code?.toUpperCase(),
        admin: r.address?.state || r.address?.county || display[1],
        source: 'nominatim' as const,
        population: r.importance ? Math.round(r.importance * 100) : undefined,
      };
    })
    .filter((h) => h.name);
}

/** Merge hits from all providers: dedupe by identity, resolve missing timezones offline. */
function mergeHits(hits: RawHit[]): GeoCity[] {
  const merged: GeoCity[] = [];
  for (const h of hits) {
    if (!h.name || Number.isNaN(h.lat) || Number.isNaN(h.lng)) continue;
    const hn = norm(h.name);
    const dupe = merged.find((m) => {
      const mn = norm(m.name);
      const near = approxSamePlace(m, h);
      const sameCountry = (m.country ?? '') === (h.country ?? '');
      // Same place: identical/shorter-variant name ("Kotdwar" vs "Kotdwāra"), or same name in same country
      const nameSiblings = mn === hn || mn.startsWith(hn) || hn.startsWith(mn);
      return near && sameCountry && nameSiblings;
    });
    if (dupe) {
      if (!dupe.population && h.population) dupe.population = h.population;
      continue;
    }
    merged.push({
      name: h.name,
      lat: h.lat,
      lng: h.lng,
      timezone: h.timezone || safeTz(h.lat, h.lng),
      country: h.country,
      admin: h.admin,
      population: h.population,
      osmValue: h.osmValue,
      source: h.source,
    });
  }
  return merged;
}

function safeTz(lat: number, lng: number): string {
  try {
    return tzLookup(lat, lng);
  } catch {
    return 'UTC';
  }
}

/**
 * Rank: match quality (exact > prefix > contains, canonical-aware) →
 * population strength → provider quality.
 */
const SOURCE_RANK: Record<GeoCity['source'], number> = {
  'open-meteo': 3,
  bundled: 3,
  photon: 2,
  nominatim: 1,
  reverse: 3,
};
function rank(hits: GeoCity[], q: string): GeoCity[] {
  const qRaw = norm(q);
  const qCanon = canonical(q);
  return [...hits].sort((a, b) => {
    const scoreDiff = matchScore(b.name, qRaw, qCanon) - matchScore(a.name, qRaw, qCanon);
    if (scoreDiff !== 0) return scoreDiff;
    const popDiff = popStrength(b) - popStrength(a);
    if (popDiff !== 0) return popDiff;
    return SOURCE_RANK[b.source] - SOURCE_RANK[a.source];
  });
}

/* ── Provider fan-out helper ─────────────────────────────────────────────── */
async function queryProviders(q: string, language: string): Promise<RawHit[]> {
  const settled = await Promise.allSettled([openMeteo(q, language), photon(q, language), nominatim(q, language)]);
  const hits: RawHit[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') hits.push(...s.value);
    else console.warn('[geocode] provider failed:', (s.reason as Error)?.message);
  }
  return hits;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    /* ── Reverse geocode mode: Nominatim → Photon → coords+tz ────────── */
    if (body.mode === 'reverse' && typeof body.lat === 'number' && typeof body.lng === 'number') {
      const { lat, lng } = body;
      let name = `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
      let country = '';
      let admin = '';

      // Nominatim reverse (city-level zoom)
      try {
        const d = (await fetchJson(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&accept-language=en&zoom=12`,
          { headers: { 'User-Agent': NOMINATIM_UA } },
        )) as { name?: string; address?: Record<string, string> };
        const a = d.address ?? {};
        const n = d.name || a.city || a.town || a.village || a.county || '';
        if (n) {
          name = n;
          country = a.country ?? '';
          admin = a.state ?? a.county ?? '';
        }
      } catch {
        /* fall through to Photon */
      }

      // Photon reverse fallback when Nominatim gave nothing
      if (country === '') {
        try {
          const d = (await fetchJson(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`)) as { features?: PhotonFeature[] };
          const p = d.features?.[0]?.properties;
          if (p) {
            const n = p.city || p.name;
            if (n) name = n;
            country = p.country ?? country;
            admin = p.state ?? admin;
          }
        } catch {
          /* offline: keep coords as name */
        }
      }

      return NextResponse.json({
        results: [{ name, lat, lng, timezone: safeTz(lat, lng), country, admin, source: 'reverse' }],
      });
    }

    /* ── Forward geocode: parallel multi-provider cascade ─────────────── */
    const placeName = String(body.placeName ?? '').trim();
    if (!placeName) return NextResponse.json({ results: [] });
    const language = body.language === 'hi' ? 'hi' : 'en';

    // Also query the space-compacted variant ("Sri Nagar" → "Srinagar") in parallel —
    // OSM indexes compound names without spaces, so this rescues spaced spellings.
    const compact = placeName.replace(/\s+/g, '');
    const [primary, alt] = await Promise.all([
      queryProviders(placeName, language),
      compact !== placeName && compact.length >= 3 ? queryProviders(compact, language) : Promise.resolve([] as RawHit[]),
    ]);

    let results = rank(mergeHits([...primary, ...alt]), placeName).slice(0, 8);

    if (results.length === 0) {
      const q = norm(placeName);
      results = FALLBACK_CITIES.filter((c) => {
        const n = norm(c.name);
        return n.startsWith(q) || n.includes(q) || norm(c.country ?? '').includes(q);
      }).slice(0, 8);
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error('[geocode]', e);
    return NextResponse.json({ results: [], error: 'geocode_failed' }, { status: 500 });
  }
}
