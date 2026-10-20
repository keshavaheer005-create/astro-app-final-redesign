'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Icon } from './icons';
import { useAppStore } from '@/store/app';
import {
  MAX_TOOLS,
  QUICK_TOOL_CATALOGUE,
  moveTool,
  normalizeToolIds,
  toggleTool,
  toolsFromIds,
  type ToolDef,
} from '@/lib/quick-tools';
import { cn } from '@/lib/utils';

/**
 * Editor for the Home shortcut strip.
 *
 * Reordering uses dnd-kit (already a dependency) with a drag handle only, so a
 * vertical drag never fights the sheet's scroll. Because drag-and-drop alone is
 * not usable with a keyboard or a screen reader, every row also has explicit
 * move-up / move-down buttons.
 */
export function QuickToolsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const quickTools = useAppStore((s) => s.quickTools);
  const setQuickTools = useAppStore((s) => s.setQuickTools);

  const ids = normalizeToolIds(quickTools);
  const selected = toolsFromIds(ids);
  const available = QUICK_TOOL_CATALOGUE.filter((tool) => !ids.includes(tool.id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    setQuickTools(moveTool(ids, from, to));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="glass max-h-[88dvh] rounded-t-3xl border-gold/25 px-4 pb-6">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-serif text-t20 text-charcoal">{t('home.quickTools.title')}</SheetTitle>
          <SheetDescription className="text-t12 leading-relaxed">{t('home.quickTools.hint')}</SheetDescription>
        </SheetHeader>

        <div className="mt-1 max-h-[62dvh] overflow-y-auto scroll-slim pr-1">
          <p className="mb-2 text-t12 font-semibold uppercase tracking-wide text-gold">
            {t('home.quickTools.yourTools', { n: ids.length, max: MAX_TOOLS })}
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1.5">
                {selected.map((tool, index) => (
                  <SortableRow
                    key={tool.id}
                    tool={tool}
                    index={index}
                    total={selected.length}
                    canRemove={ids.length > 1}
                    onMoveUp={() => setQuickTools(moveTool(ids, index, index - 1))}
                    onMoveDown={() => setQuickTools(moveTool(ids, index, index + 1))}
                    onRemove={() => setQuickTools(toggleTool(ids, tool.id))}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <p className="mb-2 mt-5 text-t12 font-semibold uppercase tracking-wide text-gold">
            {t('home.quickTools.add')}
          </p>
          {available.length === 0 ? (
            <p className="text-t12 text-muted-foreground">{t('home.quickTools.allAdded')}</p>
          ) : (
            <ul className="space-y-1.5">
              {available.map((tool) => {
                const atLimit = ids.length >= MAX_TOOLS;
                return (
                  <li key={tool.id}>
                    <button
                      type="button"
                      disabled={atLimit}
                      onClick={() => setQuickTools(toggleTool(ids, tool.id))}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border border-gold/20 bg-white/55 px-3 py-2.5 text-left transition-colors duration-200',
                        atLimit ? 'opacity-45' : 'hover:border-violet/35 hover:bg-white/75 active:scale-[0.99]',
                      )}
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-faint text-gold">
                        <Icon name={tool.icon} size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-t14 font-medium text-charcoal">{t(tool.labelKey)}</span>
                        <span className="block text-t12 text-muted-foreground">{t(tool.bodyKey)}</span>
                      </span>
                      <Icon name="plus" size={16} className="shrink-0 text-gold" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {ids.length >= MAX_TOOLS && (
            <p className="mt-2 text-t12 text-muted-foreground">{t('home.quickTools.limit', { max: MAX_TOOLS })}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SortableRow({
  tool,
  index,
  total,
  canRemove,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  tool: ToolDef;
  index: number;
  total: number;
  canRemove: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tool.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-xl border border-gold/20 bg-white/70 px-2 py-2',
        isDragging && 'opacity-80 shadow-lg',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t('home.quickTools.drag', { name: t(tool.labelKey) })}
        className="inline-flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground hover:text-charcoal active:cursor-grabbing"
      >
        <Icon name="list" size={16} />
      </button>

      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet/10 text-violet-deep">
        <Icon name={tool.icon} size={17} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-t14 font-medium text-charcoal">{t(tool.labelKey)}</span>
        <span className="block truncate text-t12 text-muted-foreground">{t(tool.bodyKey)}</span>
      </span>

      <span className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label={t('home.quickTools.moveUp', { name: t(tool.labelKey) })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-gold-faint hover:text-charcoal disabled:opacity-30"
        >
          <Icon name="chevron-up" size={14} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label={t('home.quickTools.moveDown', { name: t(tool.labelKey) })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-gold-faint hover:text-charcoal disabled:opacity-30"
        >
          <Icon name="chevron-down" size={14} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={t('home.quickTools.remove', { name: t(tool.labelKey) })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-burgundy/10 hover:text-burgundy disabled:opacity-30"
        >
          <Icon name="x" size={14} />
        </button>
      </span>
    </li>
  );
}
