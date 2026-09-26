'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, LogoMark } from '../icons';
import { GlassCard, GoldButton, GhostButton, PageLoader, Chip } from '../ui-primitives';
import { CalendarPicker, TimeWheel } from '../pickers';
import { api, useSession, type ChartData } from '../session-context';

interface GeoResult {
  name: string;
  lat: number;
  lng: number;
  timezone: string;
  country?: string;
  admin?: string;
}

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
  const [placeQuery, setPlaceQuery] = useState('');
  const [places, setPlaces] = useState<GeoResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<GeoResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const searchPlaces = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setPlaces([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api<{ results: GeoResult[] }>('/api/geocode', {
          method: 'POST',
          body: JSON.stringify({ placeName: q }),
        });
        setPlaces(res.results);
      } catch {
        setPlaces([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  const useMyLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError(t('common.locationDenied'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api<{ results: GeoResult[] }>('/api/geocode', {
            method: 'POST',
            body: JSON.stringify({ mode: 'reverse', lat: pos.coords.latitude, lng: pos.coords.longitude }),
          });
          const r = res.results[0];
          if (r) {
            setSelectedPlace(r);
            setPlaceQuery(r.name);
            setPlaces([]);
          }
        } catch {
          setLocationError(t('common.networkError'));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setLocationError(t('common.locationDenied'));
      },
      { timeout: 8000 },
    );
  };

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

  return (
    <div className="min-h-screen flex flex-col bg-cream relative">
      <div className="mandala-bg" aria-hidden="true" />
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
              className="text-center"
            >
              <LogoMark size={84} className="mx-auto mb-6" />
              <h1 className="font-serif text-t28 font-bold text-charcoal">{t('onboarding.welcome')}</h1>
              <p className="mt-2 text-gold-grad font-serif text-t16 italic">{t('splash.motto')}</p>
              <p className="mt-5 text-t14 text-muted-foreground leading-relaxed">{t('onboarding.welcomeBody')}</p>
              <div className="mt-8">
                <GoldButton onClick={() => setStep('name')}>
                  {t('onboarding.begin')} <Icon name="arrow-right" size={16} />
                </GoldButton>
              </div>
            </motion.div>
          )}

          {step === 'name' && (
            <motion.div
              key="name"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
            >
              <GlassCard className="p-6">
                <StepDots step={1} />
                <h2 className="font-serif text-t20 font-semibold text-charcoal">{t('onboarding.step.name')}</h2>
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
            </motion.div>
          )}

          {step === 'birth' && (
            <motion.div
              key="birth"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
              className="space-y-4"
            >
              <GlassCard className="p-6">
                <StepDots step={2} />
                <h2 className="font-serif text-t20 font-semibold text-charcoal mb-4">{t('onboarding.step.birth')}</h2>

                <label className="text-t12 font-medium text-muted-foreground uppercase tracking-wide">{t('onboarding.namePlaceholder')}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('onboarding.namePlaceholder')}
                  className="mt-1.5 mb-4 w-full h-11 rounded-xl border border-gold/30 bg-white/70 px-4 text-t14 outline-none transition-all duration-250 focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
                  maxLength={40}
                />

                <label className="text-t12 font-medium text-muted-foreground uppercase tracking-wide">{t('onboarding.dobLabel')}</label>
                <div className="mt-1.5 mb-4 rounded-xl border border-gold/25 bg-white/55 p-2">
                  <CalendarPicker value={dob} onChange={setDob} />
                </div>

                <label className="text-t12 font-medium text-muted-foreground uppercase tracking-wide">{t('onboarding.tobLabel')}</label>
                <div className="mt-1.5 mb-4 rounded-xl border border-gold/25 bg-white/55 p-2">
                  <TimeWheel value={tob} onChange={setTob} />
                </div>

                <label className="text-t12 font-medium text-muted-foreground uppercase tracking-wide">{t('onboarding.placeLabel')}</label>
                <div className="mt-1.5 relative">
                  <input
                    value={placeQuery}
                    onChange={(e) => {
                      setPlaceQuery(e.target.value);
                      setSelectedPlace(null);
                      searchPlaces(e.target.value);
                    }}
                    placeholder={t('onboarding.placeHint')}
                    className="w-full h-11 rounded-xl border border-gold/30 bg-white/70 px-4 pr-10 text-t14 outline-none transition-all duration-250 focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gold">
                    {searching ? <Icon name="search" size={16} className="animate-pulse" /> : <Icon name="pin" size={16} />}
                  </span>
                </div>

                {places.length > 0 && !selectedPlace && (
                  <div className="mt-2 rounded-xl border border-gold/25 bg-white/85 overflow-hidden max-h-52 overflow-y-auto scroll-slim">
                    {places.map((p, i) => (
                      <button
                        key={`${p.name}-${i}`}
                        type="button"
                        onClick={() => {
                          setSelectedPlace(p);
                          setPlaceQuery(p.name);
                          setPlaces([]);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gold-soft/70 transition-colors duration-150 flex items-center justify-between gap-2"
                      >
                        <span className="text-t14 text-charcoal">
                          {p.name}
                          {p.admin ? <span className="text-muted-foreground">, {p.admin}</span> : null}
                          {p.country ? <span className="text-muted-foreground/70"> · {p.country}</span> : null}
                        </span>
                        <span className="text-t12 text-muted-foreground/70 shrink-0">{p.timezone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!searching && placeQuery.length >= 2 && !selectedPlace && places.length === 0 && (
                  <p className="mt-2 text-t12 text-muted-foreground">{t('common.noResults')}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Chip onClick={useMyLocation}>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="locate" size={14} />
                      {locating ? t('onboarding.locating') : t('onboarding.useLocation')}
                    </span>
                  </Chip>
                  {selectedPlace && (
                    <span className="text-t12 text-sage inline-flex items-center gap-1">
                      <Icon name="check" size={14} /> {selectedPlace.name} · {selectedPlace.timezone}
                    </span>
                  )}
                </div>
                {locationError && <p className="mt-2 text-t12 text-maroon">{locationError}</p>}
                {!selectedPlace && placeQuery.length > 0 && (
                  <p className="mt-2 text-t12 text-muted-foreground/80">{t('onboarding.needPlace')}</p>
                )}
              </GlassCard>

              {confirmLine && (
                <GlassCard className="px-5 py-4">
                  <p className="font-serif text-t16 text-charcoal text-center">
                    {confirmLine}
                    {selectedPlace ? <span className="text-muted-foreground"> {t('onboarding.confirmPlace', { place: selectedPlace.name })}</span> : null}
                  </p>
                </GlassCard>
              )}

              {computeError && (
                <GlassCard className="px-5 py-4 border-maroon/30">
                  <p className="text-t14 text-maroon">{computeError}</p>
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
            </motion.div>
          )}

          {step === 'computing' && (
            <motion.div key="computing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <PageLoader label={t('onboarding.computing')} />
              <p className="text-t12 text-muted-foreground mt-2">{t('onboarding.computingHint')}</p>
            </motion.div>
          )}

          {step === 'ready' && (
            <motion.div
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
                <h2 className="font-serif text-t28 font-bold text-charcoal">{t('onboarding.ready')}</h2>
                <p className="mt-3 text-t14 text-muted-foreground leading-relaxed">{t('onboarding.readyBody')}</p>
                <div className="mt-7">
                  <GoldButton onClick={() => setStep('welcome')}>
                    {t('onboarding.enter')} <Icon name="sun" size={16} />
                  </GoldButton>
                </div>
              </GlassCard>
            </motion.div>
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
          className={`h-1.5 rounded-full transition-all duration-300 ${s <= step ? 'w-6 gold-grad' : 'w-3 bg-gold/25'}`}
        />
      ))}
    </div>
  );
}
