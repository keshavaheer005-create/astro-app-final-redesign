'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, m as mot } from 'framer-motion';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Icon, AcharyaAvatar } from '../icons';
import { GoldButton } from '../ui-primitives';
import { api, useSession } from '../session-context';
import { useAuthPrompt } from '../auth-prompt';
import { apiUrl, notifySignInRequired } from '@/lib/api';
import { isNative, nativeSpeechTranscribe } from '@/lib/native';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';
import { executeSWR, setCachedItem } from '@/lib/cache/offline-store';
import { hapticLight, hapticSuccess } from '@/lib/haptics';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  /** Journal entry date this exchange refers to ("discuss this note" thread). */
  journalRef?: string;
}

/** Compact, on-brand rendering for Acharya's organised (Markdown) replies. */
const MD_COMPONENTS: Components = {
  h1: ({ children }) => <h3 className="mt-3 first:mt-0 mb-1 font-serif text-t14 font-bold text-emerald-deep">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 first:mt-0 mb-1 font-serif text-t14 font-bold text-emerald-deep">{children}</h3>,
  h3: ({ children }) => <h3 className="mt-3 first:mt-0 mb-1 font-serif text-t14 font-bold text-emerald-deep">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-2 first:mt-0 mb-1 text-t14 font-semibold text-emerald-deep">{children}</h4>,
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-charcoal">{children}</strong>,
  ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc space-y-1 marker:text-gold">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal space-y-1 marker:text-gold">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  hr: () => null,
  a: ({ children }) => <span>{children}</span>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-t12">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-gold/30 px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-gold/15 px-2 py-1">{children}</td>,
};

const SUGGESTION_KEYS = ['acharya.suggested1', 'acharya.suggested2', 'acharya.suggested3', 'acharya.suggested4'];

export function AcharyaScreen() {
  const { t, i18n } = useTranslation();
  const { chart } = useSession();
  const { requireAuth } = useAuthPrompt();
  const language = useAppStore((s) => s.language);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Voice input — MediaRecorder → /api/asr → draft text in the composer
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [voiceError, setVoiceError] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  // TTS playback — one message at a time
  const [audioMsgId, setAudioMsgId] = useState<string | null>(null);
  const [audioLoadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setAudioMsgId(null);
  }, []);

  // stop audio when leaving the screen
  useEffect(() => () => stopAudio(), [stopAudio]);

  const listenToMessage = useCallback(
    async (m: Msg) => {
      if (audioMsgId === m.id) {
        stopAudio();
        return;
      }
      if (!requireAuth('ai')) return;
      stopAudio();
      if (audioRef.current && audioMsgId === m.id && !audioRef.current.paused) {
        // resume — unreachable here (handled above) but kept for safety
        return;
      }
      setLoadingId(m.id);
      try {
        const res = await api<{ audioDataUri: string }>('/api/acharya-audio', {
          method: 'POST',
          body: JSON.stringify({ messageId: m.id }),
        });
        const audio = new Audio(res.audioDataUri);
        audio.onended = () => {
          setAudioMsgId(null);
          audioRef.current = null;
        };
        audioRef.current = audio;
        setAudioMsgId(m.id);
        void audio.play().catch(() => setAudioMsgId(null));
      } catch {
        setAudioMsgId(null);
      } finally {
        setLoadingId(null);
      }
    },
    [audioMsgId, stopAudio, requireAuth],
  );

  const chartId = chart?.id ?? 'default';

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      try {
        await executeSWR<{ messages: Msg[] }>(
          `acharya_chat_${chartId}`,
          () => api<{ messages: Msg[] }>('/api/ask-acharya'),
          (res) => {
            if (!cancelled && res?.messages) {
              setMessages(res.messages);
            }
          },
        );
      } catch {
        /* fresh chat */
      }
    };
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [chartId]);

  // Persist messages to offline cache whenever messages update
  useEffect(() => {
    if (messages.length > 0) {
      void setCachedItem(`acharya_chat_${chartId}`, { messages });
    }
  }, [messages, chartId]);

  // One-shot handoff: a draft pushed by another screen (e.g. "discuss this
  // journal note" on the Journal tab) lands in the composer and gets focus.
  // The draft's journal date is kept so the NEXT exchange is threaded — the
  // Acharya reply then offers a "View journal entry" jump back to Journal.
  const inputRef = useRef<HTMLInputElement>(null);
  const journalRefDate = useRef<string | null>(null);
  useEffect(() => {
    const draft = useAppStore.getState().consumeAcharyaDraft();
    if (draft) {
      setInput(draft.text.slice(0, 600));
      journalRefDate.current = draft.journalDate;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Swap a just-streamed client temp id for the persisted DB id (enables per-message TTS)
  const reconcileAssistantId = useCallback(async (tempId: string, content: string) => {
    if (!content) return;
    try {
      const h = await api<{ messages: Msg[] }>('/api/ask-acharya');
      const match = [...h.messages].reverse().find((x) => x.role === 'assistant' && x.content === content);
      if (match) {
        setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, id: match.id } : x)));
      }
    } catch {
      /* TTS simply won't be offered for this turn */
    }
  }, []);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || loading) return;
      // Acharya AI is for signed-in members. The typed question stays in the
      // box, so after signing in the user just presses send again.
      if (!requireAuth('ai')) return;
      if (!chart) {
        setLoadError(true);
        return;
      }
      setLoadError(false);
      // Thread this exchange to the journal entry if it came from "discuss note"
      const reDate = journalRefDate.current;
      journalRefDate.current = null;
      void hapticLight();
      setInput('');
      const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', content: q, journalRef: reDate ?? undefined };
      const assistantId = `a-${Date.now()}-s`;
      setMessages((m) => [...m, userMsg]);
      setLoading(true);

      // Append helper: create the streaming bubble, then grow it as deltas arrive
      const appendDelta = (full: string) => {
        setMessages((m) => {
          const existing = m.find((x) => x.id === assistantId);
          if (!existing) return [...m, { id: assistantId, role: 'assistant', content: full, streaming: true, journalRef: reDate ?? undefined }];
          return m.map((x) => (x.id === assistantId ? { ...x, content: full } : x));
        });
      };
      const finishBubble = () => {
        setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, streaming: false, journalRef: reDate ?? undefined } : x)));
      };

      try {
        // Preferred path: SSE token streaming
        const res = await fetch(apiUrl('/api/ask-acharya'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, language, stream: true, journalRef: reDate ?? undefined }),
        });
        if (res.status === 401) {
          // Guest / signed-out: open the sign-in popup, keep the question, drop the bubble.
          notifySignInRequired('ai');
          setInput(q);
          setMessages((m) => m.filter((x) => x.id !== userMsg.id));
          return;
        }
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
            body: JSON.stringify({ question: q, language, journalRef: reDate ?? undefined }),
          });
          setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: r2.answer, journalRef: reDate ?? undefined } : x)));
        }
        await reconcileAssistantId(assistantId, full.trim());
        void hapticSuccess();
      } catch (e) {
        // Fallback path: classic JSON answer (covers SSE-unsupported gateways)
        try {
          const res = await api<{ answer: string }>('/api/ask-acharya', {
            method: 'POST',
            body: JSON.stringify({ question: q, language, journalRef: reDate ?? undefined }),
          });
          setMessages((m) => {
            const existing = m.find((x) => x.id === assistantId);
            if (existing) return m.map((x) => (x.id === assistantId ? { ...x, content: res.answer, streaming: false, journalRef: reDate ?? undefined } : x));
            return [...m, { id: assistantId, role: 'assistant' as const, content: res.answer, journalRef: reDate ?? undefined }];
          });
          await reconcileAssistantId(assistantId, res.answer);
          void hapticSuccess();
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
    [chart, language, loading, reconcileAssistantId, requireAuth],
  );


  const clearChat = async () => {
    // Note: history is server-side; clear visually (server retains record for grounding)
    setMessages([]);
  };

  const micSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined';

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  // stop mic + stream when leaving the screen
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    },
    [],
  );

  const transcribe = async (blob: Blob) => {
    setVoiceState('transcribing');
    try {
      const buf = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buf);
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const res = await api<{ text: string }>('/api/asr', {
        method: 'POST',
        body: JSON.stringify({ audioBase64: btoa(binary) }),
      });
      setVoiceError(false);
      setInput((prev) => (prev ? `${prev} ${res.text}`.slice(0, 600) : res.text.slice(0, 600)));
    } catch {
      setVoiceError(true);
    } finally {
      setVoiceState('idle');
    }
  };

  const toggleMic = async () => {
    if (voiceState === 'recording') {
      stopRecording();
      return;
    }
    if (voiceState !== 'idle') return;
    if (!requireAuth('ai')) return;
    setVoiceError(false);
    // Native (Capacitor) path: one-shot plugin dictation via the device's
    // speech engine — no MediaRecorder/ASR round-trip needed.
    if (isNative()) {
      setVoiceState('transcribing');
      try {
        const text = await nativeSpeechTranscribe(language);
        if (text) setInput((prev) => (prev ? `${prev} ${text}`.slice(0, 600) : text));
        setVoiceState('idle');
      } catch {
        setVoiceError(true);
        setVoiceState('idle');
      }
      return;
    }
    if (!micSupported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        recorderRef.current = null;
        if (blob.size > 1024) void transcribe(blob);
        else setVoiceState('idle');
      };
      recorderRef.current = rec;
      rec.start();
      setVoiceState('recording');
      // hard cap at 60s to keep ASR snappy
      setTimeout(() => stopRecording(), 60000);
    } catch {
      setVoiceError(true);
      setVoiceState('idle');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-4.5rem)]">
      {/* Chat header — calm emerald-tinted glass (matches the light app) with
          a single violet pulse as Acharya's intuition signature */}
      <div className="glass glass-tint-emerald bar-texture px-4 py-3 flex items-center gap-3 shrink-0 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-emerald/20 blur-2xl pointer-events-none" aria-hidden="true" />
        <div className="absolute -bottom-14 -left-10 w-28 h-28 rounded-full bg-violet/15 blur-2xl pointer-events-none" aria-hidden="true" />
        <AcharyaAvatar size={44} className="relative" />
        <div className="flex-1 min-w-0 relative">
          <p className="font-serif text-t16 font-semibold text-emerald-grad truncate">{t('acharya.title')}</p>
          <p className="text-t12 text-muted-foreground flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet animate-pulse" />
            {t('acharya.subtitle')}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            aria-label={t('acharya.clear')}
            className="relative text-muted-foreground hover:text-emerald-deep transition-colors duration-200 p-2"
          >
            <Icon name="refresh" size={17} />
          </button>
        )}
      </div>

      {/* Messages — one centered conversation column (readable width on
          desktop, full-bleed on mobile) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-slim px-1 py-4">
        <div className="mx-auto w-full max-w-3xl space-y-4">
        {messages.length === 0 && (
          <div className="text-center px-4 pt-6">
            <AcharyaAvatar size={96} className="mx-auto mb-3" />
            <p className="text-t14 text-charcoal/80 leading-relaxed max-w-md mx-auto">{chart ? t('acharya.welcome') : t('acharya.needChart')}</p>
            {chart && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTION_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => ask(t(k))}
                    className="tap-sm inline-flex min-h-[44px] items-center rounded-full border border-emerald/30 bg-emerald-soft/80 px-4 py-2 text-t12 font-medium text-emerald-deep hover:border-emerald/55 hover:bg-emerald-soft transition-colors duration-250"
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
            <mot.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className={cn('flex gap-2.5', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {m.role === 'assistant' && <AcharyaAvatar size={30} className="shrink-0 mt-1 hidden sm:block" />}
              <div className="max-w-[85%] sm:max-w-[75%] min-w-0">
                <div
                  className={cn(
                    'rounded-2xl px-4 py-3 text-t14 leading-relaxed',
                    m.role === 'user'
                      ? m.journalRef
                        ? 'gold-grad text-charcoal rounded-br-md shadow-[0_2px_10px_rgba(201,162,39,0.25)] ring-1 ring-charcoal/10'
                        : 'gold-grad text-charcoal rounded-br-md shadow-[0_2px_10px_rgba(201,162,39,0.25)]'
                      : 'glass glass-tint-emerald text-charcoal rounded-bl-md',
                  )}
                >
                  {m.role === 'assistant' ? (
                    <ReactMarkdown components={MD_COMPONENTS}>{m.content}</ReactMarkdown>
                  ) : (
                    m.content
                  )}
                  {m.streaming && (
                    <span className="inline-block w-2 h-4 ml-1 align-middle rounded-sm bg-emerald animate-pulse" aria-hidden />
                  )}
                </div>
                {/* Listen to this reply — TTS */}
                {m.role === 'assistant' && !m.streaming && m.content.length > 40 && (
                  <button
                    type="button"
                    onClick={() => void listenToMessage(m)}
                    className={cn(
                      'mt-1 ml-1 mr-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-t12 transition-all duration-250 active:scale-95',
                      audioMsgId === m.id
                        ? 'bg-gold/20 border border-gold/50 text-gold'
                        : 'border border-transparent text-muted-foreground/70 hover:text-gold hover:border-gold/30',
                    )}
                  >
                    <Icon
                      name={audioLoadingId === m.id ? 'sparkle' : audioMsgId === m.id ? 'pause' : 'speaker'}
                      size={13}
                      className={audioLoadingId === m.id ? 'animate-spin-slow' : undefined}
                    />
                    {audioLoadingId === m.id
                      ? t('acharya.preparingAudio')
                      : audioMsgId === m.id
                        ? t('acharya.stopAudio')
                        : t('acharya.listen')}
                  </button>
                )}
                {/* Threaded from a journal note — jump back to the entry */}
                {m.role === 'assistant' && !m.streaming && m.journalRef && (
                  <button
                    type="button"
                    onClick={() => {
                      useAppStore.getState().pushPendingFocus(`journal:${m.journalRef}`);
                      window.dispatchEvent(new CustomEvent('ss:navigate', { detail: { tab: 'journal' } }));
                    }}
                    title={t('acharya.viewJournal')}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gold-faint/60 border border-gold/30 px-2.5 py-1 text-t12 text-[#8a6d1f] hover:bg-gold-faint hover:border-gold/50 active:scale-95 transition-all duration-250"
                  >
                    <Icon name="journal" size={12} />
                    {t('acharya.viewJournal')}
                    <span className="opacity-60">
                      {new Date(`${m.journalRef}T12:00:00Z`).toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                    </span>
                    <Icon name="arrow-right" size={11} className="opacity-60" />
                  </button>
                )}
              </div>
            </mot.div>
          ))}
        </AnimatePresence>

        {loading && !messages.some((m) => m.streaming) && (
          <mot.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
            <AcharyaAvatar size={30} className="shrink-0 hidden sm:block" />
            <div className="glass glass-tint-emerald rounded-2xl rounded-bl-md px-4 py-3">
              <p className="text-t12 text-muted-foreground mb-1.5">{t('acharya.thinking')}</p>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-emerald animate-bounce"
                    style={{ animationDelay: `${i * 140}ms` }}
                  />
                ))}
              </div>
            </div>
          </mot.div>
        )}

        {loadError && chart && (
          <p className="text-center text-t12 text-maroon">{t('acharya.retry')}</p>
        )}
        </div>
      </div>

      {/* Composer — ONE unified glass pill anchored above the nav: mic, field
          and send live inside a single emerald-tinted bar (focus lights the
          whole bar), and the voice status is integrated so nothing floats
          detached above the typing line. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="shrink-0 pt-1.5"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        <div
          className={cn(
            'glass glass-tint-emerald mx-auto w-full max-w-3xl rounded-[26px] px-1.5 py-1.5',
            'shadow-[0_12px_36px_rgba(42,36,32,0.12)] transition-all duration-250',
            'focus-within:border-emerald/50 focus-within:shadow-[0_14px_40px_rgba(62,142,110,0.18)]',
            (!chart || loading) && 'opacity-60',
          )}
        >
          {/* live voice status — inside the bar, never detached */}
          {voiceState !== 'idle' && (
            <div className="flex items-center gap-2 px-3 pb-1 pt-1.5" aria-live="polite">
              <span className={cn('inline-flex items-center gap-1.5 text-t12', voiceState === 'recording' ? 'text-violet-deep' : 'text-muted-foreground')}>
                <Icon name={voiceState === 'recording' ? 'mic' : 'sparkle'} size={13} className={voiceState === 'recording' ? 'mic-pulse' : 'animate-spin-slow'} />
                {voiceState === 'recording' ? t('acharya.listening') : t('acharya.transcribing')}
              </span>
              {voiceState === 'recording' && <span className="h-px flex-1 bg-gradient-to-r from-violet/40 via-emerald/30 to-transparent" />}
            </div>
          )}
          {voiceError && <p className="px-3 pb-0.5 pt-1.5 text-t12 text-maroon">{t('acharya.micError')}</p>}
          <div className="flex items-center gap-1">
            {micSupported && (
              <button
                type="button"
                onClick={() => void toggleMic()}
                disabled={!chart || loading}
                aria-label={t('acharya.micLabel')}
                aria-pressed={voiceState === 'recording'}
                className={cn(
                  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-250 active:scale-90 disabled:opacity-40',
                  voiceState === 'recording'
                    ? 'bg-violet text-white mic-ring-violet'
                    : 'text-gold hover:bg-gold-faint/70',
                )}
              >
                <Icon name="mic" size={19} />
              </button>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={chart ? (voiceState === 'transcribing' ? t('acharya.voiceHint') : t('acharya.placeholder')) : t('acharya.needChart')}
              disabled={!chart || loading}
              className="h-11 min-w-0 flex-1 bg-transparent px-1.5 text-t14 text-charcoal placeholder:text-muted-foreground/60 outline-none"
              maxLength={600}
            />
            <GoldButton type="submit" disabled={!input.trim() || loading || !chart} className="h-11 w-11 shrink-0 !px-0 hover:translate-y-0">
              <Icon name="send" size={18} />
              <span className="sr-only">{t('acharya.placeholder')}</span>
            </GoldButton>
          </div>
        </div>
      </form>
    </div>
  );
}
