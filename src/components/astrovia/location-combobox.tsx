'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './icons';
import { api } from './session-context';
import { getCurrentCoords } from '@/lib/native';
import { cn } from '@/lib/utils';

export interface LocationResult {
  name: string;
  lat: number;
  lng: number;
  timezone: string;
  country?: string;
  admin?: string;
}

/**
 * Glass combobox for place search: debounced /api/geocode lookups with a
 * keyboard-navigable results list, optional "use my location" chip and an
 * onboarding-style "name · timezone" confirmation line under the input.
 */
export function LocationCombobox({
  value,
  onSelect,
  placeholder,
  showUseMyLocation = false,
  className,
  ariaLabel,
}: {
  value: string;
  onSelect: (p: { name: string; lat: number; lng: number; timezone: string; country?: string; admin?: string }) => void;
  placeholder?: string;
  showUseMyLocation?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [selected, setSelected] = useState<LocationResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();

  // parent-driven value changes (e.g. selection made elsewhere) flow back in
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // clear any pending debounce on unmount
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const runSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api<{ results: LocationResult[] }>('/api/geocode', {
          method: 'POST',
          body: JSON.stringify({ placeName: q }),
        });
        setResults(res.results);
        setActive(res.results.length > 0 ? 0 : -1);
        setOpen(true);
      } catch {
        setResults([]);
        setActive(-1);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  const choose = useCallback(
    (p: LocationResult) => {
      setSelected(p);
      onSelect(p);
      setResults([]);
      setActive(-1);
      setOpen(false);
      setQuery(p.name);
      inputRef.current?.blur();
    },
    [onSelect],
  );

  // click-outside closes
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!results.length) return;
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const next = (active + delta + results.length) % results.length;
      setActive(next);
      const el = listRef.current?.children[next];
      el?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (open && active >= 0 && results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.stopPropagation();
        setOpen(false);
      }
    }
  };

  const useMyLocation = () => {
    setLocError(null);
    setLocating(true);
    // Native (Capacitor plugin) on Android; navigator.geolocation on the web.
    getCurrentCoords()
      .then(async ({ lat, lng }) => {
        try {
          const res = await api<{ results: LocationResult[] }>('/api/geocode', {
            method: 'POST',
            body: JSON.stringify({ mode: 'reverse', lat, lng }),
          });
          const r = res.results[0];
          if (r) choose(r);
          else setLocError(t('common.noResults'));
        } catch {
          setLocError(t('common.networkError'));
        } finally {
          setLocating(false);
        }
      })
      .catch(() => {
        setLocating(false);
        setLocError(t('common.locationDenied'));
      });
  };

  const showEmpty = open && !loading && query.trim().length >= 2 && results.length === 0;
  const confirmed = selected && selected.name === value;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            runSearch(e.target.value);
          }}
          onFocus={() => {
            if (results.length) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? t('location.searchHint')}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          aria-activedescendant={open && active >= 0 ? `${listId}-opt-${active}` : undefined}
          className="w-full h-11 rounded-xl border border-gold/30 bg-white/70 px-4 pr-10 text-t14 outline-none transition-all duration-250 focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gold" aria-hidden="true">
          {loading ? <Icon name="pin" size={16} className="animate-pulse" /> : <Icon name="pin" size={16} />}
        </span>
      </div>

      {open && (
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel ?? t('common.place')}
          className="glass absolute z-30 mt-2 w-full rounded-xl border-gold/25 bg-white/90 max-h-52 overflow-y-auto scroll-slim"
        >
          {results.map((p, i) => (
            <button
              key={`${p.name}-${i}`}
              id={`${listId}-opt-${i}`}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(p)}
              className={cn(
                'w-full text-left px-4 py-2.5 transition-colors duration-150 flex items-center justify-between gap-2',
                i === active ? 'bg-gold-soft/70' : 'hover:bg-gold-soft/50',
              )}
            >
              <span className="text-t14 text-charcoal truncate">
                {p.name}
                {p.admin ? <span className="text-muted-foreground">, {p.admin}</span> : null}
                {p.country ? <span className="text-muted-foreground/70"> · {p.country}</span> : null}
              </span>
              <span className="text-t12 text-muted-foreground/70 shrink-0">{p.timezone}</span>
            </button>
          ))}
          {showEmpty && <p className="px-4 py-3 text-t12 text-muted-foreground">{t('common.noResults')}</p>}
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {showUseMyLocation && (
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="rounded-full border border-gold/30 bg-white/45 px-3 h-7 text-t12 font-medium text-muted-foreground hover:border-gold/55 hover:text-charcoal transition-all duration-250 active:scale-95 inline-flex items-center gap-1.5 disabled:opacity-45 disabled:pointer-events-none"
          >
            <Icon name="locate" size={14} className={locating ? 'animate-pulse' : undefined} />
            {locating ? t('onboarding.locating') : t('onboarding.useLocation')}
          </button>
        )}
        {value && confirmed && (
          <span className="text-t12 text-sage inline-flex items-center gap-1 min-w-0">
            <Icon name="check" size={14} className="shrink-0" />
            <span className="truncate">
              {selected.name} · {selected.timezone}
            </span>
          </span>
        )}
        {value && !confirmed && (
          <span className="text-t12 text-sage inline-flex items-center gap-1 min-w-0">
            <Icon name="check" size={14} className="shrink-0" />
            <span className="truncate">{value}</span>
          </span>
        )}
      </div>
      {locError && <p className="mt-1.5 text-t12 text-maroon">{locError}</p>}
    </div>
  );
}
