'use client';

import React from 'react';
import { Icon } from './icons';
import { openAcharyaWithPrompt } from '@/lib/acharya-handoff';
import { cn } from '@/lib/utils';

export function AskAIAction({
  question,
  label = 'Ask AI',
  className,
  compact = false,
}: {
  question: string;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => openAcharyaWithPrompt(question)}
      aria-label={label}
      className={cn(
        'tap-sm inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-emerald/25 bg-gradient-to-r from-white/75 to-emerald-soft/65 font-semibold text-emerald-deep shadow-[inset_0_1px_0_rgba(255,255,255,.8)] transition-[background,border-color,transform] duration-180 hover:border-emerald/45 hover:from-white/90 hover:to-emerald-soft active:scale-[.97]',
        compact ? 'px-2.5 text-[11px]' : 'px-3.5 text-t12',
        className,
      )}
    >
      <Icon name="sparkle" size={compact ? 12 : 14} />
      <span>{label}</span>
    </button>
  );
}
