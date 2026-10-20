'use client';

import { useAppStore } from '@/store/app';

/** Open Acharya with a contextual prompt in the composer; never auto-send or incur an AI request. */
export function openAcharyaWithPrompt(question: string): void {
  const prompt = question.trim().slice(0, 1400);
  if (!prompt || typeof window === 'undefined') return;
  useAppStore.getState().pushAcharyaDraft(prompt);
  window.dispatchEvent(new CustomEvent('ss:navigate', { detail: { tab: 'acharya' } }));
}

export function planetPrompt(input: {
  planet: string;
  sign: string;
  house: number;
  degree?: number;
  nakshatra?: string;
  retrograde?: boolean;
  combust?: boolean;
  divisionalChart?: string;
}): string {
  const details = [
    `Planet: ${input.planet}`,
    `Sign: ${input.sign}`,
    `House: ${input.house}`,
    input.degree !== undefined ? `Degree within sign: ${input.degree.toFixed(2)}°` : '',
    input.nakshatra ? `Nakshatra: ${input.nakshatra}` : '',
    input.retrograde ? 'Retrograde: yes' : '',
    input.combust ? 'Combust: yes' : '',
    input.divisionalChart ? `Chart: ${input.divisionalChart}` : '',
  ].filter(Boolean).join('; ');
  return `Explain this placement in my saved birth chart using Vedic astrology. ${details}. Connect it to the relevant house lord, aspects, dignity and current Vimshottari dasha only when supported by my chart data. Give a clear practical interpretation, mention uncertainty, and do not invent placements.`;
}
