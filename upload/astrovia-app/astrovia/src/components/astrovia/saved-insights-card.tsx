'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from './session-context';
import { GlassCard, SectionHeader } from './ui-primitives';
import { Icon } from './icons';
import { AskAIAction } from './ask-ai-action';
import { readSavedInsights, removeSavedInsight, type SavedInsight } from '@/lib/client-cache';
import { cn } from '@/lib/utils';

export function SavedInsightsCard() {
  const { t } = useTranslation();
  const { user, activeChartId } = useSession();
  const [items, setItems] = useState<SavedInsight[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setItems([]);
    setExpandedId(null);
    if (!user?.id || !activeChartId) return () => { live = false; };
    void readSavedInsights(user.id, activeChartId).then((next) => {
      if (live) setItems(next);
    });
    return () => { live = false; };
  }, [user?.id, activeChartId]);

  const remove = useCallback(async (id: string) => {
    if (!user?.id || !activeChartId) return;
    await removeSavedInsight(user.id, activeChartId, id);
    setItems((current) => current.filter((item) => item.id !== id));
    setExpandedId((current) => current === id ? null : current);
  }, [user?.id, activeChartId]);

  if (!user?.id || !activeChartId || items.length === 0) return null;
  const expanded = items.find((item) => item.id === expandedId);

  return (
    <section aria-label={t('home.savedInsights.title')} className="stagger-in" style={{ animationDelay: '55ms', animationFillMode: 'backwards' }}>
      <GlassCard className="p-4 sm:p-5 border-0">
        <SectionHeader title={t('home.savedInsights.title')} icon="bookmark" />
        <p className="-mt-1 mb-3 text-t12 text-muted-foreground">{t('home.savedInsights.subtitle', { count: items.length })}</p>
        <div className="space-y-2">
          {items.slice(0, 3).map((item) => (
            <div key={item.id} className={cn('rounded-2xl px-3 py-3 transition-colors duration-150', expandedId === item.id ? 'bg-emerald-soft/45' : 'bg-white/50')}>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold/20 to-rose/15 text-burgundy">
                  <Icon name="bookmark" size={15} />
                </span>
                <button type="button" onClick={() => setExpandedId((current) => current === item.id ? null : item.id)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/50 rounded-md">
                  <span className="block truncate text-t14 font-semibold text-charcoal">{item.title}</span>
                  <span className="mt-0.5 block text-t12 text-muted-foreground">{new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </button>
                <button type="button" onClick={() => void remove(item.id)} aria-label={t('home.savedInsights.remove')} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-rose/10 hover:text-burgundy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/50">
                  <Icon name="x" size={14} />
                </button>
              </div>
              {expandedId === item.id && (
                <div className="mt-3 pt-3">
                  <p className="whitespace-pre-wrap text-t13 leading-relaxed text-charcoal/90 max-h-40 overflow-y-auto scroll-slim">{item.content}</p>
                  <AskAIAction
                    className="mt-3"
                    compact
                    label={t('home.savedInsights.explore')}
                    question={`Continue this saved astrology insight using my saved birth chart and current dasha. Clarify anything uncertain and avoid repeating unsupported claims. Saved insight:\n${item.content.slice(0, 2800)}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        {expanded && items.length > 3 && <p className="mt-2 text-t12 text-muted-foreground">{t('home.savedInsights.more', { count: items.length - 3 })}</p>}
      </GlassCard>
    </section>
  );
}
