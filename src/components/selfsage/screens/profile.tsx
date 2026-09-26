'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, LogoMark } from '../icons';
import { GlassCard, SectionHeader, GoldButton, GhostButton } from '../ui-primitives';
import { Switch } from '@/components/ui/switch';
import { api, useSession, type ChartData } from '../session-context';
import { useAppStore } from '@/store/app';
import { OnboardingScreen } from './onboarding';
import { cn } from '@/lib/utils';

interface SavedChart {
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

export function ProfileScreen({ onChartUpdated }: { onChartUpdated: () => void }) {
  const { t } = useTranslation();
  const { user, setUser, chart, refreshChart } = useSession();
  const {
    language,
    setLanguage,
    reduceMotion,
    setReduceMotion,
    highContrast,
    setHighContrast,
    reminderEnabled,
    reminderTime,
    setReminder,
    weeklyReflectionEnabled,
    setWeeklyReflection,
  } = useAppStore();

  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [editing, setEditing] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const loadCharts = useCallback(async () => {
    try {
      const res = await api<{ charts: SavedChart[] }>('/api/charts');
      setCharts(res.charts);
    } catch {
      /* keep prior */
    }
  }, []);

  useEffect(() => {
    void loadCharts();
    void api<{ reminder: { checkinReminder: boolean; reminderTime: string; weeklyReflection: boolean } }>('/api/reminders')
      .then((r) => setReminder(r.reminder.checkinReminder, r.reminder.reminderTime))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activateChart = async (id: string) => {
    try {
      await api('/api/charts', { method: 'PATCH', body: JSON.stringify({ id, makePrimary: true }) });
      await refreshChart();
      await loadCharts();
      onChartUpdated();
    } catch {
      /* toast could go here */
    }
  };

  const deleteChart = async (id: string) => {
    try {
      await api(`/api/charts?id=${id}`, { method: 'DELETE' });
      await loadCharts();
      onChartUpdated();
    } catch {
      /* ignore */
    }
  };

  const saveLanguage = (lang: 'en' | 'hi') => {
    setLanguage(lang);
  };

  const exportData = () => {
    const payload = { user, chart, charts, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'self-sage-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (editing) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="inline-flex items-center gap-1.5 text-t14 text-gold hover:text-gold-light transition-colors duration-200"
        >
          <Icon name="arrow-left" size={16} /> {t('common.back')}
        </button>
        <OnboardingScreen onComplete={() => { setEditing(false); onChartUpdated(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-t28 font-bold text-charcoal">{t('profile.title')}</h1>
        <LogoMark size={34} className="opacity-80" />
      </header>

      {/* User card */}
      <GlassCard className="p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full gold-grad flex items-center justify-center text-charcoal font-serif text-t20 font-bold shrink-0 shadow-[0_4px_14px_rgba(201,162,39,0.35)]">
          {(chart?.input?.name || user?.name || 'S').slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-t20 font-semibold text-charcoal truncate">{chart?.input?.name || user?.name || 'Seeker'}</p>
          {chart ? (
            <p className="text-t12 text-muted-foreground truncate">
              {chart.input.dob} · {chart.input.tob} · {chart.input.placeName}
            </p>
          ) : (
            <p className="text-t12 text-muted-foreground">{t('home.noChartBody')}</p>
          )}
          {user && !user.isGuest && user.email && (
            <p className="text-t12 text-sage truncate">{t('profile.signedInAs', { email: user.email })}</p>
          )}
        </div>
        {chart && (
          <GhostButton className="shrink-0 h-9 px-3.5 text-t12" onClick={() => setEditing(true)}>
            <Icon name="edit" size={14} /> {t('profile.editBirth')}
          </GhostButton>
        )}
      </GlassCard>

      {/* Saved charts */}
      <section>
        <SectionHeader
          title={t('profile.yourChart')}
          icon="chart"
          action={
            <GhostButton className="h-8 px-3 text-t12" onClick={() => setEditing(true)}>
              <Icon name="plus" size={13} /> {t('profile.addChart')}
            </GhostButton>
          }
        />
        <div className="space-y-2.5 max-h-80 overflow-y-auto scroll-slim pr-1">
          {charts.length === 0 && <p className="text-t14 text-muted-foreground px-1">{t('home.noChart')}</p>}
          {charts.map((c) => (
            <GlassCard key={c.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-t14 font-semibold text-charcoal truncate">
                  {c.name} {c.isPrimary && <span className="ml-1.5 rounded-full gold-grad px-2 py-0.5 text-t12 font-bold text-charcoal">{t('profile.active')}</span>}
                </p>
                <p className="text-t12 text-muted-foreground truncate">
                  {c.dob} · {c.tob} · {c.placeName ?? `${c.lat.toFixed(1)}, ${c.lng.toFixed(1)}`}
                </p>
              </div>
              {!c.isPrimary && (
                <button
                  type="button"
                  onClick={() => activateChart(c.id)}
                  className="text-t12 text-gold hover:text-gold-light transition-colors duration-200 shrink-0"
                >
                  {t('profile.setActive')}
                </button>
              )}
              <button
                type="button"
                onClick={() => deleteChart(c.id)}
                aria-label={t('profile.delete')}
                className="text-muted-foreground/60 hover:text-maroon transition-colors duration-200 p-1.5 shrink-0"
              >
                <Icon name="x" size={15} />
              </button>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Language */}
      <section>
        <SectionHeader title={t('profile.language')} icon="globe" />
        <GlassCard className="p-4">
          <p className="text-t12 text-muted-foreground mb-3">{t('profile.languageHint')}</p>
          <div className="flex gap-2.5">
            {(['en', 'hi'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => saveLanguage(lang)}
                className={cn(
                  'flex-1 h-12 rounded-2xl border text-t14 font-semibold transition-all duration-250 ease-out active:scale-[0.98]',
                  language === lang
                    ? 'gold-grad border-gold/50 text-charcoal shadow-[0_2px_12px_rgba(201,162,39,0.35)]'
                    : 'border-gold/25 bg-white/50 text-muted-foreground hover:border-gold/50 hover:text-charcoal',
                )}
              >
                {lang === 'en' ? 'English' : 'हिन्दी'}
              </button>
            ))}
          </div>
        </GlassCard>
      </section>

      {/* Reminders */}
      <section>
        <SectionHeader title={t('profile.reminders')} icon="bell" />
        <GlassCard className="p-4 divide-y divide-gold/15">
          <div className="flex items-center justify-between gap-3 pb-3">
            <div>
              <p className="text-t14 font-medium text-charcoal">{t('profile.reminderCheckin')}</p>
              <p className="text-t12 text-muted-foreground">{t('profile.reminderTime', { time: reminderTime })}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminder(reminderEnabled, e.target.value)}
                className="h-9 rounded-lg border border-gold/25 bg-white/60 px-2 text-t12 outline-none"
                aria-label={t('profile.reminderTime', { time: reminderTime })}
              />
              <Switch
                checked={reminderEnabled}
                onCheckedChange={(v) => setReminder(v, reminderTime)}
                className="data-[state=checked]:bg-gold"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-3">
            <p className="text-t14 font-medium text-charcoal">{t('profile.weeklyReflection')}</p>
            <Switch
              checked={weeklyReflectionEnabled}
              onCheckedChange={setWeeklyReflection}
              className="data-[state=checked]:bg-gold"
            />
          </div>
        </GlassCard>
      </section>

      {/* Display */}
      <section>
        <SectionHeader title={t('profile.display')} icon="eye" />
        <GlassCard className="p-4 divide-y divide-gold/15">
          <div className="flex items-center justify-between gap-3 pb-3">
            <div>
              <p className="text-t14 font-medium text-charcoal">{t('profile.reduceMotion')}</p>
              <p className="text-t12 text-muted-foreground">{t('profile.reduceMotionHint')}</p>
            </div>
            <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} className="data-[state=checked]:bg-gold" />
          </div>
          <div className="flex items-center justify-between gap-3 pt-3">
            <p className="text-t14 font-medium text-charcoal">{t('profile.highContrast')}</p>
            <Switch checked={highContrast} onCheckedChange={setHighContrast} className="data-[state=checked]:bg-gold" />
          </div>
        </GlassCard>
      </section>

      {/* Account */}
      <section>
        <SectionHeader title={t('profile.account')} icon="user" />
        <GlassCard className="p-4">
          {user && !user.isGuest ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-t14 text-charcoal truncate">{user.email}</p>
              <GhostButton
                className="h-9 text-t12 shrink-0"
                onClick={async () => {
                  await api('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) });
                  setUser(null);
                  location.reload();
                }}
              >
                <Icon name="logout" size={14} /> {t('profile.signOut')}
              </GhostButton>
            </div>
          ) : (
            <div>
              <p className="text-t14 font-medium text-charcoal">{t('profile.guest')}</p>
              <p className="text-t12 text-muted-foreground mt-0.5 mb-3">{t('profile.guestHint')}</p>
              {!authOpen ? (
                <GoldButton className="h-10 text-t14" onClick={() => setAuthOpen(true)}>
                  <Icon name="shield" size={15} /> {t('profile.signIn')}
                </GoldButton>
              ) : (
                <AuthForm onDone={() => setAuthOpen(false)} />
              )}
            </div>
          )}
        </GlassCard>
      </section>

      {/* About */}
      <section>
        <SectionHeader title={t('profile.about')} icon="info" />
        <GlassCard className="p-4">
          <p className="text-t14 text-charcoal/85 leading-relaxed">{t('profile.aboutBody')}</p>
          <div className="mt-3 flex items-center gap-2 text-t12 text-muted-foreground">
            <Icon name="planet" size={14} className="text-gold" />
            {t('profile.engine')}: Swiss Ephemeris 2.10 · {t('profile.ayanamsa')} · whole-sign houses
          </div>
          <button
            type="button"
            onClick={exportData}
            className="mt-3 inline-flex items-center gap-1.5 text-t12 text-gold hover:text-gold-light transition-colors duration-200"
          >
            <Icon name="download" size={14} /> {t('profile.exportData')}
          </button>
        </GlassCard>
      </section>
    </div>
  );
}

function AuthForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { setUser } = useSession();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await api<{ user: { id: string; email: string; isGuest: boolean } }>('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: mode, email, password }),
      });
      setUser({ ...res.user, name: null });
      onDone();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === 'email_taken' ? t('auth.errorTaken') : msg === 'invalid_credentials' ? t('auth.errorCredentials') : t('auth.errorInvalid'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('auth.email')}
        className="w-full h-10 rounded-xl border border-gold/30 bg-white/70 px-3.5 text-t14 outline-none focus:border-gold/60 transition-all duration-250"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t('auth.password')}
        className="w-full h-10 rounded-xl border border-gold/30 bg-white/70 px-3.5 text-t14 outline-none focus:border-gold/60 transition-all duration-250"
      />
      {error && <p className="text-t12 text-maroon">{error}</p>}
      <div className="flex items-center gap-2">
        <GoldButton className="h-10 text-t14" onClick={submit} disabled={working || !email || password.length < 6}>
          {working ? t('auth.working') : mode === 'signup' ? t('auth.signup') : t('auth.login')}
        </GoldButton>
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'signup' ? 'login' : 'signup'))}
          className="text-t12 text-gold hover:underline"
        >
          {mode === 'signup' ? t('auth.switchToLogin') : t('auth.switchToSignup')}
        </button>
      </div>
    </div>
  );
}
