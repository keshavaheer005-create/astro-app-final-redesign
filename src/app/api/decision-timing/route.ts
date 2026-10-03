import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser, memberGuard } from '@/lib/session';
import { getActiveChart } from '@/lib/active-chart';
import { computeChart } from '@/lib/astro/chart';
import { calcPlanet, juldayFromUTC, utcFromJulday } from '@/lib/astro/ephemeris';
import { moonNakshatraNow, GOCHARA_BENEFIC } from '@/lib/astro/horoscope';
import { NAKSHATRAS, TITHIS, norm360, signIndex } from '@/lib/astro/constants';
import { decisionPhrasing } from '@/lib/ai';
import { timeInZone } from '@/lib/tz';

export const runtime = 'nodejs';
export const maxDuration = 60;

const AVOID_TITHI_IDX = [3, 8, 13]; // Chaturthi, Navami, Chaturdashi (0-based within paksha)
const AVOID_NAKSHATRAS = new Set([
  'Ardra', 'Ashlesha', 'Magha', 'Jyeshtha', 'Mula', 'Shatabhisha', 'Krittika',
]);
const GOOD_NAKSHATRAS = new Set([
  'Pushya', 'Hasta', 'Anuradha', 'Shravana', 'Dhanishta', 'Revati', 'Punarvasu', 'Swati', 'Chitra', 'Uttara Phalguni',
]);

/**
 * POST /api/decision-timing
 * body { decisionText, language? }
 * Computes REAL factors: current dasha lords' gochara, today's panchang quality,
 * Moon transit from natal Moon; scans the next 14 days for cleaner windows.
 */
export async function POST(req: Request) {
  try {
    const blocked = await memberGuard('ai');
    if (blocked) return blocked;
    const user = await ensureUser();
    const { decisionText, language } = await req.json();
    const decision = String(decisionText ?? '').trim();
    if (!decision) return NextResponse.json({ error: 'empty_decision' }, { status: 400 });
    const lang = language === 'hi' ? 'hi' : 'en';

    const saved = await getActiveChart(user.id);
    if (!saved) return NextResponse.json({ error: 'no_chart' }, { status: 400 });

    const chart = computeChart({
      name: saved.name,
      dob: saved.dob,
      tob: saved.tob,
      lat: saved.lat,
      lng: saved.lng,
      timezone: saved.timezone,
    });
    const natalMoonSign = chart.moonSign.index;
    const ds = chart.dashaSnapshot;
    const now = new Date();
    const jdNow = juldayFromUTC(now);

    const factors: string[] = [];
    let score = 55;

    // 1. Dasha context
    if (ds) {
      const dashaGood = ['Ju', 'Ve', 'Me', 'Mo'].includes(ds.mahaLord);
      factors.push(
        `${ds.mahaLord} mahadasha${ds.antarLord ? ` with ${ds.antarLord} antardasha` : ''} until ${ds.mahaEnd}${dashaGood ? ' — a supportive planetary period' : ' — a period that asks for patience and structure'}`,
      );
      score += dashaGood ? 10 : -8;
    }

    // 2. Today's Moon transit from natal Moon
    const moonNow = calcPlanet('Mo', jdNow, true);
    const houseFromMoon = ((signIndex(moonNow.lon) - natalMoonSign) % 12 + 12) % 12 + 1;
    const moonGood = GOCHARA_BENEFIC.Mo.includes(houseFromMoon);
    factors.push(`Moon transits ${houseFromMoon}th from your natal Moon sign today — ${moonGood ? 'a supportive gochara position' : 'not among the Moon\u2019s favorable stations'}`);
    score += moonGood ? 12 : -10;

    // 3. Today's panchang quality
    const nak = moonNakshatraNow(now);
    const tithiElong = norm360(moonNow.lon - calcPlanet('Su', jdNow, true).lon);
    const tithiIdx0 = Math.floor(tithiElong / 12);
    const tithiName = TITHIS[tithiIdx0 % 15];
    const nakGood = GOOD_NAKSHATRAS.has(nak.name);
    const nakBad = AVOID_NAKSHATRAS.has(nak.name);
    const tithiBad = AVOID_TITHI_IDX.includes(tithiIdx0 % 15);
    factors.push(`Today runs on ${nak.name} nakshatra, ${tithiName} tithi — ${nakGood ? 'a steady star for starting things' : nakBad ? 'a star better suited to planning than launching' : 'a neutral star'}`);
    score += nakGood ? 10 : nakBad ? -10 : 0;
    if (tithiBad) {
      factors.push(`${tithiName} is traditionally a rikta tithi — less ideal for beginnings`);
      score -= 6;
    }

    // 4. Saturn's pressure (Sade Sati)
    if (chart.sadeSati.active) {
      factors.push(`Sade Sati is active (${chart.sadeSati.phase} phase) — Saturn advises slower, well-documented moves`);
      score -= 6;
    }

    // 5. Scan next 14 days for cleaner windows (Moon gochara + nakshatra quality)
    const windows: string[] = [];
    for (let day = 1; day <= 14 && windows.length < 3; day++) {
      const d = new Date(now.getTime() + day * 86400000);
      const jd = juldayFromUTC(d);
      const m = calcPlanet('Mo', jd, true);
      const h = ((signIndex(m.lon) - natalMoonSign) % 12 + 12) % 12 + 1;
      const n = moonNakshatraNow(d);
      if (GOCHARA_BENEFIC.Mo.includes(h) && GOOD_NAKSHATRAS.has(n.name)) {
        windows.push(d.toISOString().slice(0, 10));
      }
    }

    const bounded = Math.max(5, Math.min(95, score));
    const verdict: 'favorable' | 'mixed' | 'wait' = bounded >= 68 ? 'favorable' : bounded >= 48 ? 'mixed' : 'wait';

    const dashaContext = ds ? `${ds.mahaLord} mahadasha / ${ds.antarLord ?? '—'} antardasha` : '';
    const phrased = await decisionPhrasing({
      decisionText: decision,
      language: lang,
      verdict,
      score: bounded,
      factors,
      windows,
      dashaContext,
    });

    await db.decisionCheck.create({
      data: {
        userId: user.id,
        chartId: saved.id,
        decisionText: decision.slice(0, 500),
        verdict: JSON.stringify({ verdict, score: bounded, factors, windows }),
      },
    });

    return NextResponse.json({
      verdict,
      score: bounded,
      factors,
      windows,
      narrative: phrased,
      todayLabel: {
        nakshatra: NAKSHATRAS[nak.index],
        localTime: timeInZone(saved.timezone, now),
      },
    });
  } catch (e) {
    console.error('[decision-timing]', e);
    return NextResponse.json({ error: 'timing_failed' }, { status: 500 });
  }
}
