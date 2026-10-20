'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, LogoMark } from '../icons';
import { GlassCard, SectionHeader, GoldButton, GhostButton, useSlidingIndicator } from '../ui-primitives';
import { Switch } from '@/components/ui/switch';
import { api, useSession, type ChartData } from '../session-context';
import { useAppStore } from '@/store/app';
import { birthDateLabel } from '@/lib/dates';
import { AuthCard } from '../auth-card';
import { authGateway } from '@/lib/supabase/client';
import { cancelDailyReminders, saveTextFile } from '@/lib/native';
import { clearAccountCache, clearAllClientCaches, isPersistent } from '@/lib/client-cache';
import { useAuthPrompt } from '../auth-prompt';
import { ChartForm } from '../chart-form';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const { user, setUser, chart, setChart, refreshChart, activateChart, forgetChartSnapshot } = useSession();
  const { toast } = useToast();
  // One confirm dialog for both destructive actions (data is per chart now).
  const [confirm, setConfirm] = useState<{ kind: 'chart'; id: string; name: string } | { kind: 'all' } | null>(null);
  const [busy, setBusy] = useState(false);
  const { requireAuth } = useAuthPrompt();
  const {
    language,
    setLanguage,
    highContrast,
    setHighContrast,
    reminderEnabled,
    reminderTime,
    setReminder,
    weeklyReflectionEnabled,
    setWeeklyReflection,
  } = useAppStore();

  const [charts, setCharts] = useState<SavedChart[]>([]);
  // Inline add/edit form — replaces the old replay-onboarding "profile loop".
  const [form, setForm] = useState<null | { mode: 'add' | 'edit'; chart?: SavedChart }>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [flash, setFlash] = useState<'added' | 'updated' | null>(null);

  // Active chart = isPrimary row, else first row; last resort derives from the
  // session chart so "Edit birth" still opens when the list fetch failed.
  const activeSaved = charts.find((c) => c.isPrimary) ?? charts[0];
  const chartFromSession = (): SavedChart | undefined => {
    if (!chart?.input) return undefined;
    return {
      id: '',
      name: String(chart.input.name ?? ''),
      dob: String(chart.input.dob),
      tob: String(chart.input.tob),
      lat: Number(chart.input.lat),
      lng: Number(chart.input.lng),
      timezone: String(chart.input.timezone),
      placeName: chart.input.placeName ? String(chart.input.placeName) : null,
      isPrimary: true,
    };
  };

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(id);
  }, [flash]);

  const loadCharts = useCallback(async () => {
    try {
      const res = await api<{ charts: SavedChart[] }>('/api/charts');
      setCharts(res.charts);
    } catch {
      /* keep prior */
    }
  }, []);

  useEffect(() => {
    // Fire-and-forget bootstrap fetches; state updates land in promise callbacks.
    void loadCharts();
    void api<{ reminder: { checkinReminder: boolean; reminderTime: string; weeklyReflection: boolean } }>('/api/reminders')
      .then((r) => setReminder(r.reminder.checkinReminder, r.reminder.reminderTime))
      .catch(() => undefined);

  }, []);

  const activateChartRow = async (id: string) => {
    try {
      // Session-level switch: paints this chart's on-device snapshot first and
      // never leaves the previous profile's chart on screen.
      await activateChart(id);
      await loadCharts();
      onChartUpdated();
    } catch {
      /* toast could go here */
    }
  };

  const deleteChart = async (id: string) => {
    try {
      await api(`/api/charts?id=${id}`, { method: 'DELETE' });
      // Drop this chart's snapshot/chat before anything can paint them again.
      forgetChartSnapshot(id);
      await refreshChart(); // the server makes another chart active if needed
      await loadCharts();
      onChartUpdated();
    } catch {
      /* ignore */
    }
  };

  // Wipe every chart + journal + Acharya chat + letters + decisions of this
  // account (login stays). With no chart left the app opens the profile-making
  // screen again. The on-device copies go first so nothing private survives in
  // the browser's storage after the server has deleted the originals.
  const clearAll = async () => {
    setBusy(true);
    try {
      await api('/api/account/clear', { method: 'POST', body: JSON.stringify({ confirm: 'CLEAR_ALL' }) });
      setConfirm(null);
      void cancelDailyReminders();
      await clearAllClientCaches();
      toast({ title: t('profile.clearDone') });
      setChart(null);
      await refreshChart();
    } catch {
      toast({ title: t('profile.clearFailed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  /** Forget the instant-load copies kept on this device (charts + Acharya chat). */
  const clearDeviceCache = async () => {
    await clearAllClientCaches();
    toast({ title: t('profile.cacheCleared') });
  };

  const saveLanguage = (lang: 'en' | 'hi') => {
    setLanguage(lang);
  };

  // Sliding pill for the EN/हिन्दी segmented control (transform-animated,
  // same pattern as the app-shell nav indicator — no popping states)
  const langIndex = language === 'en' ? 0 : 1;
  const { bind: bindLang, style: langPill } = useSlidingIndicator(langIndex, false);

  const exportData = () => {
    const payload = { user, chart, charts, exportedAt: new Date().toISOString() };
    void saveTextFile('astrovia-export.json', JSON.stringify(payload, null, 2)).catch(() => {
      /* share sheet dismissed */
    });
  };

  return (
    <div className="relative space-y-6 max-w-3xl">
      {/* Deep burgundy atmosphere — the whole-screen gradient comes from
          ScreenGradient (app-shell); the wine-toned corner mandala accents it */}
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-t28 font-bold text-burgundy-grad">{t('profile.title')}</h1>
        <LogoMark size={34} className="opacity-80" />
      </header>

      {/* Inline add / edit form — renders in place, no onboarding replay */}
      {form && (
        <ChartForm
          mode={form.mode}
          chart={form.chart}
          onSaved={() => {
            setFlash(form.mode === 'add' ? 'added' : 'updated');
            setForm(null);
            void loadCharts();
            onChartUpdated();
          }}
          onCancel={() => setForm(null)}
        />
      )}

      {/* User card */}
      <GlassCard className="p-5 flex items-center gap-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <div className="relative w-14 h-14 rounded-full gold-grad flex items-center justify-center text-charcoal font-serif text-t20 font-bold shadow-[0_4px_14px_rgba(201,162,39,0.35)]">
            {(chart?.input?.name || user?.name || 'S').slice(0, 1).toUpperCase()}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-t20 font-semibold text-charcoal truncate">{chart?.input?.name || user?.name || 'Seeker'}</p>
          {chart ? (
            <p className="text-t12 text-muted-foreground line-clamp-2 leading-snug" title={`${birthDateLabel(chart.input.dob, language)} · ${chart.input.tob} · ${chart.input.placeName}`}>
              {birthDateLabel(chart.input.dob, language)} · {chart.input.tob} · {chart.input.placeName}
            </p>
          ) : (
            <p className="text-t12 text-muted-foreground">{t('home.noChartBody')}</p>
          )}
          {user && !user.isGuest && user.email && (
            <p className="text-t12 text-sage truncate">{t('profile.signedInAs', { email: user.email })}</p>
          )}
        </div>
        {chart && (
          <GhostButton
            className="shrink-0 h-9 px-3.5 text-t12"
            onClick={() => setForm({ mode: 'edit', chart: activeSaved ?? chartFromSession() })}
          >
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
            <GhostButton className="h-9 px-3.5 text-t12" onClick={() => { if (requireAuth('charts')) setForm({ mode: 'add' }); }}>
              <Icon name="plus" size={14} /> {t('profile.addChart')}
            </GhostButton>
          }
        />
        {flash && (
          <p className="mb-2.5 flex items-center gap-1.5 text-t12 text-emerald" role="status">
            <Icon name="check" size={14} className="shrink-0" />
            {t(flash === 'added' ? 'profile.chartForm.added' : 'profile.chartForm.updated')}
          </p>
        )}
        <div className="space-y-2.5 max-h-80 overflow-y-auto scroll-slim pr-1">
          {charts.length === 0 && <p className="text-t14 text-muted-foreground px-1">{t('home.noChart')}</p>}
          {charts.map((c) => (
            <GlassCard key={c.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-t14 font-semibold text-charcoal truncate">
                  {c.name} {c.isPrimary && <span className="ml-1.5 rounded-full gold-grad px-2 py-0.5 text-t12 font-bold text-charcoal">{t('profile.active')}</span>}
                </p>
                <p className="text-t12 text-muted-foreground truncate">
                  {birthDateLabel(c.dob, language)} · {c.tob} · {c.placeName ?? `${c.lat.toFixed(1)}, ${c.lng.toFixed(1)}`}
                </p>
              </div>
              {!c.isPrimary && (
                <button
                  type="button"
                  onClick={() => void activateChartRow(c.id)}
                  className="tap-sm text-t12 text-emerald hover:text-emerald-deep transition-colors duration-200 shrink-0"
                >
                  {t('profile.setActive')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setForm({ mode: 'edit', chart: c })}
                aria-label={t('profile.chartForm.editChart')}
                className="tap-sm text-muted-foreground/60 hover:text-gold transition-colors duration-200 -m-1 p-2.5 shrink-0"
              >
                <Icon name="edit" size={16} />
              </button>
              <button
                type="button"
                onClick={() => setConfirm({ kind: 'chart', id: c.id, name: c.name })}
                aria-label={t('profile.delete')}
                className="tap-sm text-muted-foreground/60 hover:text-burgundy transition-colors duration-200 -m-1 p-2.5 shrink-0"
              >
                <Icon name="x" size={16} />
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
          {/* Segmented control with a sliding gold pill indicator (260ms ease).
              48px rows keep the 44px+ Android touch target; each option has
              press feedback and an aria-pressed state. */}
          <div className="relative flex rounded-2xl border border-gold/25 bg-white/50 p-1" role="group" aria-label={t('profile.language')}>
            <span
              aria-hidden="true"
              className="absolute rounded-xl gold-grad shadow-[0_2px_12px_rgba(201,162,39,0.35)]"
              style={{
                top: 4,
                bottom: 4,
                ...langPill,
                transition: 'transform 260ms ease, width 260ms ease, opacity 200ms ease',
              }}
            />
            {(['en', 'hi'] as const).map((lang, i) => (
              <button
                key={lang}
                ref={bindLang(i)}
                type="button"
                aria-pressed={language === lang}
                onClick={() => saveLanguage(lang)}
                className={cn(
                  'tap-sm relative z-10 flex-1 h-12 rounded-xl text-t14 font-semibold transition-colors duration-250 ease-out',
                  language === lang
                    ? 'text-charcoal'
                    : 'text-muted-foreground hover:text-charcoal',
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
        <GlassCard className="p-4">
          <div className="flex items-center justify-between gap-3">
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
                  await cancelDailyReminders();
                  // Sign-out must not leave this account's charts/chats readable
                  // on the device for whoever signs in next.
                  await clearAccountCache(user?.id ?? null);
                  await authGateway.signOut();
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
                <AuthCard onAuthed={() => setAuthOpen(false)} />
              )}
            </div>
          )}
        </GlassCard>
      </section>

      {/* Your data */}
      <section>
        <SectionHeader title={t('profile.dataTitle')} icon="shield" />
        <GlassCard className="p-4">
          <p className="text-t12 leading-relaxed text-muted-foreground">{t('profile.clearAllHint')}</p>
          <button
            type="button"
            onClick={() => setConfirm({ kind: 'all' })}
            className="tap-sm mt-3 inline-flex h-10 items-center gap-1.5 rounded-full border border-burgundy/40 px-4 text-t14 font-medium text-burgundy transition-colors duration-200 hover:bg-burgundy/5"
          >
            <Icon name="x" size={14} /> {t('profile.clearAll')}
          </button>
          <div className="mt-4 border-t border-gold/15 pt-3">
            <p className="text-t12 leading-relaxed text-muted-foreground">{t('profile.cacheHint')}</p>
            <button
              type="button"
              onClick={() => void clearDeviceCache()}
              className="tap-sm mt-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2 -ml-2 text-t12 font-medium text-gold hover:bg-gold-faint transition-colors duration-200"
            >
              <Icon name="refresh" size={13} /> {t('profile.clearCache')}
            </button>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground/70">
              {isPersistent() ? t('profile.cacheKindIdb') : t('profile.cacheKindSession')}
            </p>
          </div>
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
            className="tap-sm mt-3 -ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-t12 font-medium text-gold hover:bg-gold-faint hover:text-gold-light transition-colors duration-200"
          >
            <Icon name="download" size={14} /> {t('profile.exportData')}
          </button>
        </GlassCard>
      </section>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o && !busy) setConfirm(null); }}>
        <AlertDialogContent className="glass border-gold/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-charcoal">
              {confirm?.kind === 'chart' ? t('profile.deleteChartTitle') : t('profile.clearAllTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              {confirm?.kind === 'chart'
                ? t('profile.deleteChartBody', { name: confirm.name })
                : t('profile.clearAllBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-burgundy text-white hover:bg-burgundy/90"
              onClick={async (e) => {
                e.preventDefault(); // keep the dialog open until the request finishes
                if (!confirm) return;
                setBusy(true);
                if (confirm.kind === 'chart') {
                  await deleteChart(confirm.id);
                  setConfirm(null);
                  setBusy(false);
                } else {
                  await clearAll();
                }
              }}
            >
              {busy ? t('auth.working') : confirm?.kind === 'chart' ? t('profile.deleteChartConfirm') : t('profile.clearAllConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

