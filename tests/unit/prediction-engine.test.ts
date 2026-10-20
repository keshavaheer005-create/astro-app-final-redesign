/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { PLANET_ORDER, SIGN_LORDS } from '../../src/lib/astro/constants';
import type { ComputedChart } from '../../src/lib/astro/chart';
import { buildPredictiveOutlook, classifyDecisionTopic, predictionThemeHouses } from '../../src/lib/astro/prediction-engine';
import { VARGA_LIST } from '../../src/lib/astro/varga';

function chartFixture(ashtakavargaApprox = false): ComputedChart {
  const planets = PLANET_ORDER.map((key, index) => ({
    key,
    lon: index * 17,
    lonTropical: index * 17,
    sign: key === 'Sa' ? 6 : index,
    signName: 'Fixture',
    degInSign: index,
    house: key === 'Ju' ? 10 : index + 1,
    nakshatra: index,
    nakshatraName: 'Fixture',
    pada: 1,
    retrograde: false,
    speed: 1,
    combust: false,
  }));
  const houses = Array.from({ length: 12 }, (_, index) => ({
    index: index + 1,
    sign: index,
    signName: 'Fixture',
    lord: SIGN_LORDS[index],
  }));
  const divisionalCharts = Object.fromEntries(VARGA_LIST.map((id) => [id, {
    id,
    ascSign: 0,
    planets: Object.fromEntries(PLANET_ORDER.map((key, index) => [key, key === 'Sa' ? 6 : index])),
  }]));
  const dasha = {
    lord: 'Ju', start: '2000-01-01', end: '2099-01-01', years: 16,
    antardashas: [{ lord: 'Me', start: '2020-01-01', end: '2090-01-01' }],
  };
  return {
    input: { name: 'Test', dob: '1990-01-01', tob: '12:00', lat: 0, lng: 0, timezone: 'UTC', utcISO: '1990-01-01T12:00:00.000Z' },
    ayanamsa: 24,
    ascendant: { lon: 0, sign: 0, signName: 'Aries', signNameHi: 'मेष', nakshatra: 'Ashwini', nakshatraHi: 'अश्विनी', pada: 1, degInSign: 0 },
    mc: { lon: 0 },
    moonSign: { index: 4, name: 'Leo', nameHi: 'सिंह' },
    sunSign: { index: 0, name: 'Aries', nameHi: 'मेष' },
    planets,
    outerPlanets: [],
    houses,
    dashas: { mahadashas: [dasha], balanceAtBirth: { lord: 'Ju', yearsLeft: 1 }, current: null },
    dashaSnapshot: null,
    divisionalCharts,
    ashtakavarga: { bav: { Su: [], Mo: [], Ma: [], Me: [], Ju: [], Ve: [], Sa: [] }, sav: Array(12).fill(30), ascBindus: 30, moonBindus: 30 },
    ashtakavargaApprox,
    mangalDosha: {} as ComputedChart['mangalDosha'],
    sadeSati: { active: false } as ComputedChart['sadeSati'],
    birthPanchang: { tithiName: 'Fixture', tithiPaksha: 'Shukla', nakshatraName: 'Fixture', yogaName: 'Fixture', karanaName: 'Fixture' },
  } as unknown as ComputedChart;
}

describe('prediction engine topic routing', () => {
  test('classifies common English and Hindi decision intents', () => {
    expect(classifyDecisionTopic('Should I change jobs this month?')).toBe('career');
    expect(classifyDecisionTopic('Is marriage on the horizon?')).toBe('relationships');
    expect(classifyDecisionTopic('How should I invest my savings?')).toBe('wealth');
    expect(classifyDecisionTopic('मेरी पढ़ाई और परीक्षा कैसी रहेगी?')).toBe('learning');
    expect(classifyDecisionTopic('What should I reflect on?')).toBe('general');
  });

  test('returns fixed theme house mappings without inventing a score', () => {
    expect(predictionThemeHouses('career')).toEqual([10, 6, 2, 11]);
    expect(predictionThemeHouses('relationships')).toEqual([7, 5, 2, 8]);
    expect(predictionThemeHouses('general')).toEqual([1, 5, 9, 10, 11]);
  });

  test('explains theme signals with explicit dasha, transit and chart evidence', () => {
    const chart = chartFixture(false);
    const transits = { Ju: { lon: 5 * 30 + 4 } };
    const result = buildPredictiveOutlook(chart, transits, new Date('2026-10-19T12:00:00Z'));
    expect(result.themes).toHaveLength(6);
    const career = result.themes.find((theme) => theme.id === 'career')!;
    expect(career.signals.some((signal) => signal.code === 'dasha_house' && signal.planet === 'Ju')).toBe(true);
    expect(career.signals.some((signal) => signal.code === 'transit_aspect' && signal.planet === 'Ju')).toBe(true);
    expect(career.signals.some((signal) => signal.code === 'sav_transit_strength' && signal.bindus === 30)).toBe(true);
    expect(career.tone).toBe('supportive');
    expect(result.caveat).toBe('traditional_interpretation_not_certainty');
  });

  test('never uses fallback Ashtakavarga values to claim chart-specific support', () => {
    const result = buildPredictiveOutlook(chartFixture(true), { Ju: { lon: 5 * 30 + 4 } }, new Date('2026-10-19T12:00:00Z'));
    expect(result.ashtakavargaApprox).toBe(true);
    expect(result.themes.some((theme) => theme.signals.some((signal) => signal.code === 'sav_transit_strength'))).toBe(false);
  });
});
