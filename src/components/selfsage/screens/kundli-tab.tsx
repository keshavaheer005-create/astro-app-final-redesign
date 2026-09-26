'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidingPillTabs } from '../ui-primitives';
import { KundliChartScreen } from './kundli-chart';
import { PanchangScreen } from './kundli-panchang';
import { HoroscopeScreen } from './kundli-horoscope';
import { MatchingScreen } from './kundli-matching';
import { ReportsScreen } from './kundli-reports';

export type KundliView = 'chart' | 'panchang' | 'horoscope' | 'matching' | 'reports';

export function KundliTab({ initialView }: { initialView?: KundliView }) {
  const { t } = useTranslation();
  const [view, setView] = useState<KundliView>(initialView ?? 'chart');

  return (
    <div className="space-y-4">
      <SlidingPillTabs<KundliView>
        tabs={[
          { id: 'chart', label: t('kundli.tab.chart') },
          { id: 'panchang', label: t('kundli.tab.panchang') },
          { id: 'horoscope', label: t('kundli.tab.horoscope') },
          { id: 'matching', label: t('kundli.tab.matching') },
          { id: 'reports', label: t('kundli.tab.reports') },
        ]}
        active={view}
        onChange={setView}
      />
      <div key={view} className="stagger-in">
        {view === 'chart' && <KundliChartScreen />}
        {view === 'panchang' && <PanchangScreen />}
        {view === 'horoscope' && <HoroscopeScreen />}
        {view === 'matching' && <MatchingScreen />}
        {view === 'reports' && <ReportsScreen />}
      </div>
    </div>
  );
}
