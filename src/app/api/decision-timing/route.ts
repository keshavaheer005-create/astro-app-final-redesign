import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser, memberGuard } from '@/lib/session';
import { getActiveChart } from '@/lib/active-chart';
import { computeChartCached as computeChart } from '@/lib/astro/chart-cache';
import { calcAllPlanets, juldayFromUTC } from '@/lib/astro/ephemeris';
import { GOCHARA_BENEFIC } from '@/lib/astro/horoscope';
import { NAKSHATRAS, TITHIS, norm360, signIndex } from '@/lib/astro/constants';
import { decisionPhrasing } from '@/lib/ai';
import { timeInZone, ymdInZone } from '@/lib/tz';
import { memo } from '@/lib/cache';
import { buildPredictiveOutlook, classifyDecisionTopic, findDecisionWindows, predictionThemeHouses } from '@/lib/astro/prediction-engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/decision-timing
 * body { decisionText, language? }
 * Computes current dasha, gochara and Panchang factors, then ranks day-level
 * windows for the user's inferred life-area theme over the next three weeks.
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
    const topic = classifyDecisionTopic(decision);
    const transitSnapshot = calcAllPlanets(jdNow, true);
    const outlook = buildPredictiveOutlook(chart, transitSnapshot, now);
    const themeOutlook = topic === 'general' ? null : outlook.themes.find((theme) => theme.id === topic) ?? null;

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

    // 2. Add topic-specific chart activation without turning it into a probability.
    if (themeOutlook && topic !== 'general') {
      const topicHouses = predictionThemeHouses(topic);
      factors.push(`Question theme: ${topic}; houses considered ${topicHouses.join(', ')}; divisional lens ${themeOutlook.varga}.`);
      const evidence = themeOutlook.signals.slice(0, 3).map((signal) => {
        if (signal.code === 'dasha_house') return `${signal.planet} dasha activates house ${signal.house}`;
        if (signal.code === 'dasha_lordship') return `${signal.planet} rules house ${signal.house}`;
        if (signal.code === 'transit_aspect') return `${signal.planet} transit contacts house ${signal.house}`;
        if (signal.code === 'sav_transit_strength') return `${signal.planet} transit sign has ${signal.bindus} SAV bindus`;
        if (signal.code === 'natal_lord_dignity') return `${signal.planet} as life-area lord is ${signal.dignity}`;
        if (signal.code === 'varga_anchor') return `${signal.planet} is placed in ${signal.varga} sign ${signal.sign}`;
        if (signal.code === 'd9_alignment') return `${signal.planet} has same-sign D1/D9 alignment`;
        return '';
      }).filter(Boolean);
      if (evidence.length) factors.push(`Topic-specific factors: ${evidence.join('; ')}.`);
      if (themeOutlook.activationCount > 0) score += Math.min(6, themeOutlook.activationCount * 2);
      if (themeOutlook.tone === 'supportive') score += 6;
      if (themeOutlook.tone === 'reflective') score -= 4;
      factors.push(`Traditional ${topic} lens: ${themeOutlook.tone}; this is a qualitative rule summary, not a success probability.`);
      if (outlook.ashtakavargaApprox) factors.push('Ashtakavarga values are approximate in this chart and were excluded from the topical lens.');
    }

    // 3. Today's Moon transit from natal Moon
    const moonNow = transitSnapshot.Mo;
    const houseFromMoon = ((signIndex(moonNow.lon) - natalMoonSign) % 12 + 12) % 12 + 1;
    const moonGood = GOCHARA_BENEFIC.Mo.includes(houseFromMoon);
    factors.push(`Moon transits ${houseFromMoon}th from your natal Moon sign today — ${moonGood ? 'a supportive gochara position' : 'not among the Moon\u2019s favorable stations'}`);
    score += moonGood ? 12 : -10;

    // 4. Today's panchang quality
    const nakIndex = Math.floor(norm360(moonNow.lon) / (360 / 27));
    const nak = { index: nakIndex, name: NAKSHATRAS[nakIndex] };
    const tithiElong = norm360(moonNow.lon - transitSnapshot.Su.lon);
    const tithiIdx0 = Math.floor(tithiElong / 12);
    const tithiName = TITHIS[tithiIdx0 % 15];
    const nakGood = ['Pushya', 'Hasta', 'Anuradha', 'Shravana', 'Dhanishta', 'Revati', 'Punarvasu', 'Swati', 'Chitra', 'Uttara Phalguni'].includes(nak.name);
    const nakBad = ['Ardra', 'Ashlesha', 'Magha', 'Jyeshtha', 'Mula', 'Shatabhisha', 'Krittika'].includes(nak.name);
    const tithiBad = [3, 8, 13].includes(tithiIdx0 % 15);
    factors.push(`Today runs on ${nak.name} nakshatra, ${tithiName} tithi — ${nakGood ? 'a steady star for starting things' : nakBad ? 'a star better suited to planning than launching' : 'a neutral star'}`);
    score += nakGood ? 10 : nakBad ? -10 : 0;
    if (tithiBad) {
      factors.push(`${tithiName} is traditionally a rikta tithi — less ideal for beginnings`);
      score -= 6;
    }

    // 5. Saturn's pressure (Sade Sati)
    if (chart.sadeSati.active) {
      factors.push(`Sade Sati is active (${chart.sadeSati.phase} phase) — Saturn advises slower, well-documented moves`);
      score -= 6;
    }

    // 6. Scan the next 21 local calendar days, ranked by the requested theme.
    // Cache the expensive ephemeris scan per chart, local day and topic.
    const localToday = ymdInZone(saved.timezone, now);
    const rankedWindows = memo(
      `decision-windows|${saved.id}|${localToday}|${topic}`,
      3 * 60 * 60 * 1000,
      () => findDecisionWindows(chart, topic, now, saved.timezone, 21),
    );
    const windows = rankedWindows.map((window) => window.date);

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
      dashaContext: `${dashaContext}${topic !== 'general' ? `; question theme: ${topic}` : ''}`,
    });

    await db.decisionCheck.create({
      data: {
        userId: user.id,
        chartId: saved.id,
        decisionText: decision.slice(0, 500),
        verdict: JSON.stringify({ verdict, score: bounded, factors, windows, topic }),
      },
    });

    return NextResponse.json({
      verdict,
      score: bounded,
      factors,
      windows,
      topic,
      methodNote: 'traditional_interpretation_not_certainty',
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
