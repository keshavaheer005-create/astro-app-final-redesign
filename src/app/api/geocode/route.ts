import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface GeoCity {
  name: string;
  lat: number;
  lng: number;
  timezone: string;
  country?: string;
  admin?: string;
}

// Bundled fallback (offline resilience): major cities with correct timezones
const FALLBACK_CITIES: GeoCity[] = [
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
];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Reverse geocode mode
    if (body.mode === 'reverse' && typeof body.lat === 'number' && typeof body.lng === 'number') {
      const { lat, lng } = body;
      let name = `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
      let timezone = guessTzFromLongitude(lng, lat);
      try {
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
          { signal: AbortSignal.timeout(6000) },
        );
        if (res.ok) {
          const data = await res.json();
          name = data.city || data.locality || data.principalSubdivision || name;
        }
      } catch {
        /* offline: keep coords as name */
      }
      // refine timezone with nearest bundled city when close
      let best = FALLBACK_CITIES[0];
      let bestD = Infinity;
      for (const c of FALLBACK_CITIES) {
        const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (bestD < 4) timezone = best.timezone;
      return NextResponse.json({ results: [{ name, lat, lng, timezone, country: '' }] });
    }

    const placeName = String(body.placeName ?? '').trim();
    if (!placeName) return NextResponse.json({ results: [] });

    const results: GeoCity[] = [];
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(placeName)}&count=8&language=en&format=json`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (res.ok) {
        const data = await res.json();
        for (const r of data.results ?? []) {
          results.push({
            name: r.name,
            lat: r.latitude,
            lng: r.longitude,
            timezone: r.timezone || 'UTC',
            country: r.country,
            admin: r.admin1,
          });
        }
      }
    } catch {
      /* fall to offline list */
    }

    if (results.length === 0) {
      const q = placeName.toLowerCase();
      results.push(
        ...FALLBACK_CITIES.filter(
          (c) => c.name.toLowerCase().includes(q) || (c.country ?? '').toLowerCase().includes(q),
        ).slice(0, 8),
      );
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error('[geocode]', e);
    return NextResponse.json({ results: [], error: 'geocode_failed' }, { status: 500 });
  }
}

function guessTzFromLongitude(lng: number, lat: number): string {
  if (lng >= 68 && lng <= 97 && lat >= 6 && lat <= 37) return 'Asia/Kolkata';
  if (lng >= -8 && lng < 30) return 'Europe/London';
  if (lng >= 30 && lng < 60) return 'Europe/Moscow';
  if (lng >= 100 && lng < 125) return 'Asia/Singapore';
  if (lng >= 125 && lng < 150) return 'Asia/Tokyo';
  if (lng >= 135 && lat < 0) return 'Australia/Sydney';
  if (lng < -60) return 'America/New_York';
  if (lng >= -60 && lng < -30) return 'America/Sao_Paulo';
  return 'UTC';
}
