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
        'tap-sm inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-emerald-soft/80 font-semibold text-emerald-deep',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_10px_-4px_rgba(37,106,88,0.3)] backdrop-blur-sm',
        'transition-[background,box-shadow,transform] duration-200 hover:bg-emerald-soft hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_3px_14px_-4px_rgba(37,106,88,0.4)] active:scale-[.97]',
        compact ? 'px-2.5 text-t12' : 'px-3.5 text-t12',
        className,
      )}
    >
      <Icon name="sparkle" size={compact ? 12 : 14} />
      <span>{label}</span>
    </button>
  );
}
