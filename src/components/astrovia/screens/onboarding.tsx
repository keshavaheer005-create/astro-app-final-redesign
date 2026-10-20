'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, m as mot } from 'framer-motion';
import { Icon, LogoMark } from '../icons';
import { GlassCard, GoldButton, GhostButton } from '../ui-primitives';
import { GlassDatePicker, TimeWheel } from '../pickers';
import { LocationCombobox, type LocationResult } from '../location-combobox';
import { ChakraBackdrop, ChakraSpinner, OmEmblem, ScreenGradient } from '../chakra';
import { api, useSession, type ChartData } from '../session-context';

type Step = 'welcome' | 'name' | 'birth' | 'computing' | 'ready';

export function OnboardingScreen({ onComplete }: { onComplete?: () => void }) {
  const { t, i18n } = useTranslation();
  const { saveChart } = useSession();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [dob, setDob] = useState(() => {
    const d = new Date();
    return `${d.getFullYear() - 25}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [tob, setTob] = useState('08:30');
  const [selectedPlace, setSelectedPlace] = useState<LocationResult | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);

  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';

  const confirmLine = (() => {
    try {
      const [y, m, d] = dob.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      const dateStr = dt.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
      const [hh, mm] = tob.split(':').map(Number);
      const hour12 = ((hh + 11) % 12) + 1;
      const timeStr = `${hour12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
      return t('onboarding.confirmLine', { date: dateStr, time: timeStr });
    } catch {
      return '';
    }
  })();

  const computeChart = async () => {
    if (!selectedPlace) return;
    setStep('computing');
    setComputeError(null);
    try {
      const res = await api<{ chart: ChartData }>('/api/chart', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || 'Seeker',
          dob,
          tob,
          lat: selectedPlace.lat,
          lng: selectedPlace.lng,
          timezone: selectedPlace.timezone,
          placeName: selectedPlace.name,
          save: true,
        }),
      });
      await saveChart(
        {
          name: name.trim() || 'Seeker',
          dob,
          tob,
          lat: selectedPlace.lat,
          lng: selectedPlace.lng,
          timezone: selectedPlace.timezone,
          placeName: selectedPlace.name,
        },
        res.chart,
      );
      setStep('ready');
      onComplete?.();
    } catch (e) {
      console.error(e);
      setComputeError(t('common.networkError'));
      setStep('birth');
    }
  };

  const canProceedBirth = !!selectedPlace;

  // The setup flow owns its atmosphere: gold welcome → violet birth details →
  // emerald computing → gold ready. Cross-fades via ScreenGradient.
  const stepTone: Record<Step, string> = {
    welcome: 'gold',
    name: 'violet',
    birth: 'violet',
    computing: 'emerald',
    ready: 'gold',
  };

  return (
    <div className="min-h-dvh flex flex-col bg-cream relative">
      <ChakraBackdrop />
      <ScreenGradient tone={stepTone[step]} />
      <div className="relative z-10 flex-1 w-full max-w-lg mx-auto px-4 py-8 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <mot.div
              key="welcome"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
              className="text-center"
            >
              <div className="relative mx-auto mb-6 flex h-[84px] w-[84px] items-center justify-center">
                <LogoMark size={84} className="relative" />
              </div>
              <h1 className="font-serif text-t28 font-bold text-gold-grad">{t('onboarding.welcome')}</h1>
              <p className="mt-2 text-gold-grad font-serif text-t16 italic">{t('splash.motto')}</p>
              <p className="mt-5 text-t14 text-muted-foreground leading-relaxed">{t('onboarding.welcomeBody')}</p>
              <div className="mt-8">
                <GoldButton onClick={() => setStep('name')}>
                  {t('onboarding.begin')} <Icon name="arrow-right" size={16} />
                </GoldButton>
              </div>
            </mot.div>
          )}

          {step === 'name' && (
            <mot.div
              key="name"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
            >
              <GlassCard className="p-6">
                <StepDots step={1} />
                <h2 className="font-serif text-t20 font-semibold text-violet-grad">{t('onboarding.step.name')}</h2>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep('birth')}
                  placeholder={t('onboarding.namePlaceholder')}
                  className="mt-5 w-full h-12 rounded-2xl border border-gold/30 bg-white/70 px-4 text-t16 text-charcoal placeholder:text-muted-foreground/60 outline-none transition-all duration-250 focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
                  maxLength={40}
                />
                <div className="mt-6 flex justify-between items-center">
                  <GhostButton onClick={() => setStep('welcome')}>
                    <Icon name="arrow-left" size={16} /> {t('common.back')}
                  </GhostButton>
                  <GoldButton disabled={!name.trim()} onClick={() => setStep('birth')}>
                    {t('common.next')} <Icon name="arrow-right" size={16} />
                  </GoldButton>
                </div>
              </GlassCard>
            </mot.div>
          )}

          {step === 'birth' && (
            <mot.div
              key="birth"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
              className="space-y-4"
            >
              <GlassCard className="p-6">
                <StepDots step={2} />
                <h2 className="font-serif text-t20 font-semibold text-violet-grad mb-4">{t('onboarding.step.birth')}</h2>

                <label className="text-t12 font-medium text-muted-foreground uppercase tracking-wide">{t('onboarding.namePlaceholder')}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('onboarding.namePlaceholder')}
                  className="mt-1.5 mb-4 w-full h-11 rounded-xl border border-gold/30 bg-white/70 px-4 text-t14 outline-none transition-all duration-250 focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
                  maxLength={40}
                />

                <label className="text-t12 font-medium text-muted-foreground uppercase tracking-wide">{t('onboarding.dobLabel')}</label>
                <div className="mt-1.5 mb-4">
                  <GlassDatePicker value={dob} onChange={setDob} ariaLabel={t('onboarding.dobLabel')} />
                </div>

                <label className="text-t12 font-medium text-muted-foreground uppercase tracking-wide">{t('onboarding.tobLabel')}</label>
                <div className="mt-1.5 mb-4 rounded-xl border border-gold/25 bg-white/55 p-2">
                  <TimeWheel value={tob} onChange={setTob} />
                </div>

                <label className="text-t12 font-medium text-muted-foreground uppercase tracking-wide">{t('onboarding.placeLabel')}</label>
                <LocationCombobox
                  className="mt-1.5"
                  value={selectedPlace?.name ?? ''}
                  onSelect={setSelectedPlace}
                  showUseMyLocation
                  ariaLabel={t('onboarding.placeLabel')}
                />
              </GlassCard>

              {confirmLine && (
                <GlassCard className="px-5 py-4 border-emerald/30 bg-emerald-soft/70">
                  <p className="flex flex-wrap items-center justify-center gap-x-1.5 font-serif text-t16 text-emerald-deep text-center">
                    <Icon name="check" size={15} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
                    <span>{confirmLine}</span>
                    {selectedPlace ? <span className="text-emerald-deep/75"> {t('onboarding.confirmPlace', { place: selectedPlace.name })}</span> : null}
                  </p>
                </GlassCard>
              )}

              {computeError && (
                <GlassCard className="px-5 py-4 border-burgundy/30 bg-burgundy-soft/70">
                  <p className="text-t14 text-burgundy">{computeError}</p>
                </GlassCard>
              )}

              <div className="flex justify-between items-center">
                <GhostButton onClick={() => setStep('name')}>
                  <Icon name="arrow-left" size={16} /> {t('common.back')}
                </GhostButton>
                <GoldButton disabled={!canProceedBirth} onClick={computeChart}>
                  {t('common.next')} <Icon name="sparkle" size={16} />
                </GoldButton>
              </div>
            </mot.div>
          )}

          {step === 'computing' && (
            <mot.div key="computing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <ChakraSpinner size={56} label={t('onboarding.computing')} />
              <p className="text-t12 text-muted-foreground mt-2">{t('onboarding.computingHint')}</p>
            </mot.div>
          )}

          {step === 'ready' && (
            <mot.div
              key="ready"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="text-center"
            >
              <GlassCard className="p-8">
                <div className="mx-auto w-16 h-16 rounded-full gold-grad flex items-center justify-center mb-5 shadow-[0_6px_24px_rgba(201,162,39,0.4)]">
                  <Icon name="check" size={30} strokeWidth={2} />
                </div>
                <h2 className="font-serif text-t28 font-bold text-gold-grad">{t('onboarding.ready')}</h2>
                <p className="mt-3 text-t14 text-muted-foreground leading-relaxed">{t('onboarding.readyBody')}</p>
                {/* A quiet Om seal — the birth chart is received, not just built */}
                <div className="mt-4 flex justify-center text-violet/70">
                  <OmEmblem size={54} strokeWidth={1.5} />
                </div>
                <div className="mt-5">
                  <GoldButton onClick={() => setStep('welcome')}>
                    {t('onboarding.enter')} <Icon name="sun" size={16} />
                  </GoldButton>
                </div>
              </GlassCard>
            </mot.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-4" aria-hidden="true">
      {[1, 2].map((s) => (
        <span
          key={s}
          className={`h-1.5 rounded-full transition-all duration-300 ${s <= step ? 'w-6 violet-grad' : 'w-3 bg-violet/25'}`}
        />
      ))}
    </div>
  );
}
