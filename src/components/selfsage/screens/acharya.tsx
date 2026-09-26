'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, AcharyaAvatar } from '../icons';
import { GoldButton } from '../ui-primitives';
import { api, useSession } from '../session-context';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

const SUGGESTION_KEYS = ['acharya.suggested1', 'acharya.suggested2', 'acharya.suggested3', 'acharya.suggested4'];

export function AcharyaScreen() {
  const { t } = useTranslation();
  const { chart } = useSession();
  const language = useAppStore((s) => s.language);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await api<{ messages: Msg[] }>('/api/ask-acharya');
        setMessages(res.messages);
      } catch {
        /* fresh chat */
      }
    };
    void loadHistory();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || loading) return;
      if (!chart) {
        setLoadError(true);
        return;
      }
      setLoadError(false);
      setInput('');
      const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', content: q };
      const assistantId = `a-${Date.now()}-s`;
      setMessages((m) => [...m, userMsg]);
      setLoading(true);

      // Append helper: create the streaming bubble, then grow it as deltas arrive
      const appendDelta = (full: string) => {
        setMessages((m) => {
          const existing = m.find((x) => x.id === assistantId);
          if (!existing) return [...m, { id: assistantId, role: 'assistant', content: full, streaming: true }];
          return m.map((x) => (x.id === assistantId ? { ...x, content: full } : x));
        });
      };
      const finishBubble = () => {
        setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, streaming: false } : x)));
      };

      try {
        // Preferred path: SSE token streaming
        const res = await fetch('/api/ask-acharya', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, language, stream: true }),
        });
        if (!res.ok || !res.body) {
          let msg = `HTTP ${res.status}`;
          try {
            msg = ((await res.json()) as { error?: string }).error ?? msg;
          } catch { /* non-JSON error */ }
          throw new Error(msg);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        let full = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf('\n\n')) >= 0) {
            const evt = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const line = evt.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const obj = JSON.parse(payload) as { v?: string };
              if (obj.v) {
                full += obj.v;
                appendDelta(full);
              }
            } catch {
              full += payload;
              appendDelta(full);
            }
          }
        }
        finishBubble();
        if (!full.trim()) {
          // Stream produced nothing — fall back to the non-streaming endpoint
          const r2 = await api<{ answer: string }>('/api/ask-acharya', {
            method: 'POST',
            body: JSON.stringify({ question: q, language }),
          });
          setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: r2.answer } : x)));
        }
      } catch (e) {
        // Fallback path: classic JSON answer (covers SSE-unsupported gateways)
        try {
          const res = await api<{ answer: string }>('/api/ask-acharya', {
            method: 'POST',
            body: JSON.stringify({ question: q, language }),
          });
          setMessages((m) => {
            const existing = m.find((x) => x.id === assistantId);
            if (existing) return m.map((x) => (x.id === assistantId ? { ...x, content: res.answer, streaming: false } : x));
            return [...m, { id: assistantId, role: 'assistant' as const, content: res.answer }];
          });
        } catch {
          setLoadError(true);
          console.error('[acharya]', e);
          // remove the empty streaming bubble if it was created
          setMessages((m) => m.filter((x) => x.id !== assistantId || x.content.length > 0));
        }
      } finally {
        setLoading(false);
      }
    },
    [chart, language, loading],
  );

  const clearChat = async () => {
    // Note: history is server-side; clear visually (server retains record for grounding)
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-11rem)] lg:h-[calc(100dvh-9rem)]">
      {/* Chat header — inverted ink card */}
      <div className="glass-ink px-4 py-3 flex items-center gap-3 shrink-0">
        <AcharyaAvatar size={44} />
        <div className="flex-1 min-w-0">
          <p className="font-serif text-t16 font-semibold text-gold-grad truncate">{t('acharya.title')}</p>
          <p className="text-t12 text-[#a5947a] flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
            {t('acharya.subtitle')}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            aria-label={t('acharya.clear')}
            className="text-[#a5947a] hover:text-gold-light transition-colors duration-200 p-2"
          >
            <Icon name="refresh" size={17} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-slim px-1 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center px-4 pt-6">
            <AcharyaAvatar size={84} className="mx-auto mb-4 opacity-90" />
            <p className="text-t14 text-charcoal/80 leading-relaxed max-w-md mx-auto">{chart ? t('acharya.welcome') : t('acharya.needChart')}</p>
            {chart && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTION_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => ask(t(k))}
                    className="glass rounded-full px-4 py-2 text-t12 text-charcoal/80 hover:text-charcoal hover:border-gold/50 transition-all duration-250 active:scale-95"
                  >
                    {t(k)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className={cn('flex gap-2.5', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {m.role === 'assistant' && <AcharyaAvatar size={30} className="shrink-0 mt-1 hidden sm:block" />}
              <div
                className={cn(
                  'max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-t14 leading-relaxed',
                  m.role === 'user'
                    ? 'gold-grad text-charcoal rounded-br-md shadow-[0_2px_10px_rgba(201,162,39,0.25)]'
                    : 'glass text-charcoal rounded-bl-md',
                )}
              >
                {m.content}
                {m.streaming && (
                  <span className="inline-block w-2 h-4 ml-1 align-middle rounded-sm bg-gold animate-pulse" aria-hidden />
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && !messages.some((m) => m.streaming) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
            <AcharyaAvatar size={30} className="shrink-0 hidden sm:block" />
            <div className="glass rounded-2xl rounded-bl-md px-4 py-3">
              <p className="text-t12 text-muted-foreground mb-1.5">{t('acharya.thinking')}</p>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-gold animate-bounce"
                    style={{ animationDelay: `${i * 140}ms` }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {loadError && chart && (
          <p className="text-center text-t12 text-maroon">{t('acharya.retry')}</p>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="shrink-0 flex items-center gap-2 pt-1"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={chart ? t('acharya.placeholder') : t('acharya.needChart')}
          disabled={!chart || loading}
          className="flex-1 h-12 rounded-full glass px-5 text-t14 text-charcoal placeholder:text-muted-foreground/60 outline-none transition-all duration-250 focus:border-gold/50 focus:ring-2 focus:ring-gold/25 disabled:opacity-60"
          maxLength={600}
        />
        <GoldButton type="submit" disabled={!input.trim() || loading || !chart} className="w-12 h-12 p-0 !px-0 shrink-0">
          <Icon name="send" size={18} />
          <span className="sr-only">{t('acharya.placeholder')}</span>
        </GoldButton>
      </form>
    </div>
  );
}
