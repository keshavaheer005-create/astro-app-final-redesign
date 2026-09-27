'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GoldButton, GhostButton } from './ui-primitives';
import { GlassDatePicker, TimeWheel } from './pickers';
import { LocationCombobox, type LocationResult } from './location-combobox';
import { api, useSession } from './session-context';

/**
 * Shape of a saved chart row as returned by GET /api/charts (subset used here).
 * Structurally compatible with the SavedChart interface in screens/profile.tsx.
 */
export interface ChartFormChart {
  id: string;
  name: string;
  dob: string;
  tob: string;
  lat: number;
  lng: number;
  timezone: string;
  placeName: string | null;
  isPrimary: boolean;
}

const defaultDob = () => {
  const d = new Date();
  return `${d.getFullYear() - 25}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Inline add/edit birth-chart form for the Profile screen.
 * Unlike onboarding there is no welcome/computing/ready flow — one glass card.
 *  - mode 'edit' → PUT /api/charts (updates in place, keeps isPrimary, server
 *    recomputes chartData) then refreshChart() so an active chart updates live.
 *  - mode 'add' → POST /api/charts WITHOUT makePrimary/chartData — the new
 *    chart stays dormant until the user taps "Set active".
 */
export function ChartForm({
  mode,
  chart,
  onSaved,
  onCancel,
}: {
  mode: 'add' | 'edit';
  chart?: ChartFormChart;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { refreshChart } = useSession();

  const [name, setName] = useState(chart?.name ?? '');
  const [dob, setDob] = useState(chart?.dob ?? defaultDob());
  const [tob, setTob] = useState(chart?.tob ?? '08:30');
  const [place, setPlace] = useState<LocationResult | null>(
    chart
      ? { name: chart.placeName ?? `${chart.lat.toFixed(2)}, ${chart.lng.toFixed(2)}`, lat: chart.lat, lng: chart.lng, timezone: chart.timezone }
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!place) return;
    setSaving(true);
    setError(null);
    const details = {
      name: name.trim() || undefined,
      dob,
      tob,
      lat: place.lat,
      lng: place.lng,
      timezone: place.timezone,
      placeName: place.name,
    };
    try {
      if (mode === 'edit') {
        if (!chart) {
          setError(t('common.networkError'));
          return;
        }
        await api('/api/charts', {
          method: 'PUT',
          body: JSON.stringify({ id: chart.id, ...details }),
        });
        await refreshChart();
      } else {
        // Deliberately no makePrimary / chartData — server tolerates null and
        // the chart stays dormant until "Set active".
        await api('/api/charts', { method: 'POST', body: JSON.stringify(details) });
      }
      onSaved();
    } catch {
      setError(t('common.networkError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard className="p-6">
      <h2 className="font-serif text-t20 font-semibold text-charcoal mb-4">
        {t(mode === 'add' ? 'profile.chartForm.add' : 'profile.chartForm.edit')}
      </h2>

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
        <GlassDatePicker value={dob} onChange={setDob} minYear={1900} ariaLabel={t('onboarding.dobLabel')} />
      </div>

      <label className="text-t12 font-medium text-muted-foreground uppercase tracking-wide">{t('onboarding.tobLabel')}</label>
      <div className="mt-1.5 mb-4 rounded-xl border border-gold/25 bg-white/55 p-2">
        <TimeWheel value={tob} onChange={setTob} />
      </div>

      <label className="text-t12 font-medium text-muted-foreground uppercase tracking-wide">{t('onboarding.placeLabel')}</label>
      <LocationCombobox
        className="mt-1.5"
        value={place?.name ?? ''}
        onSelect={setPlace}
        showUseMyLocation
        ariaLabel={t('onboarding.placeLabel')}
      />

      {error && <p className="mt-3 text-t12 text-maroon">{error}</p>}

      <div className="mt-5 flex items-center justify-between">
        <GhostButton onClick={onCancel} disabled={saving}>
          {t('common.cancel')}
        </GhostButton>
        <GoldButton onClick={save} disabled={saving || !place}>
          {saving ? t('profile.chartForm.saving') : t('profile.chartForm.save')}
        </GoldButton>
      </div>
    </GlassCard>
  );
}
