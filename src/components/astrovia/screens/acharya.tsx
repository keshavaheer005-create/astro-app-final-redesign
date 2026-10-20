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
import { readCachedChatSummaries, readChatHistory, writeChatHistory, readSavedInsights, saveInsight, removeSavedInsight, type SavedInsight } from '@/lib/client-cache';
import { count, end, start } from '@/lib/perf';
import { isNative, nativeSpeechStop, nativeSpeechTranscribe } from '@/lib/native';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  streaming?: boolean;
  /** Streamed reply the server has not confirmed yet — never persisted, no TTS. */
  pending?: boolean;
  /** Journal entry date this exchange refers to ("discuss this note" thread). */
  journalRef?: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  messageCount: number;
}

const LEGACY_CONVERSATION_ID = 'legacy';
// Kept in module memory (not persisted). Navigating between tabs keeps the
// current conversation, while a full app/WebView restart naturally creates a
// fresh chat the next time Acharya opens.
const sessionConversationIds = new Map<string, string>();
// New ids have no server transcript yet, so opening one should show the welcome
// state immediately without issuing an empty-history network request.
const freshConversationIds = new Set<string>();

function makeConversationId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* restricted WebView */ }
  return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function sessionKey(userId: string, chartId: string): string {
  return `${userId}|${chartId}`;
}

function getSessionConversationId(userId: string, chartId: string): string {
  const key = sessionKey(userId, chartId);
  let id = sessionConversationIds.get(key);
  if (!id) {
    id = makeConversationId();
    sessionConversationIds.set(key, id);
    freshConversationIds.add(id);
  }
  return id;
}

function setSessionConversationId(userId: string, chartId: string, id: string): void {
  sessionConversationIds.set(sessionKey(userId, chartId), id);
}

function conversationGroupId(updatedAt: string): 'today' | 'yesterday' | 'older' {
  const date = new Date(updatedAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (day === today) return 'today';
  if (day === today - 86_400_000) return 'yesterday';
  return 'older';
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


interface MessageRowProps {
  message: Msg;
  focusMode: boolean;
  audioMsgId: string | null;
  audioLoadingId: string | null;
  locale: string;
  translate: (key: string) => string;
  onListen: (message: Msg) => void;
  onViewJournal: (journalRef: string) => void;
  saved: boolean;
  onToggleSave: (message: Msg) => void;
}

const MessageRow = React.memo(function MessageRow({
  message: m,
  focusMode,
  audioMsgId,
  audioLoadingId,
  locale,
  translate,
  onListen,
  onViewJournal,
  saved,
  onToggleSave,
}: MessageRowProps) {
  return (
    <mot.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={cn('flex gap-2.5', m.role === 'user' ? 'justify-end' : 'justify-start')}
    >
      {m.role === 'assistant' && <AcharyaAvatar size={30} className="shrink-0 mt-1 hidden sm:block" />}
      <div className={cn('min-w-0', focusMode ? 'max-w-[96%] sm:max-w-[88%]' : 'max-w-[85%] sm:max-w-[75%]')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 leading-relaxed',
            focusMode ? 'text-[15px] sm:text-base sm:px-5 sm:py-4' : 'text-t14',
            m.role === 'user'
              ? m.journalRef
                ? 'gold-grad text-charcoal rounded-br-md shadow-[0_2px_10px_rgba(201,162,39,0.2)] ring-1 ring-charcoal/10'
                : 'gold-grad text-charcoal rounded-br-md shadow-[0_2px_10px_rgba(201,162,39,0.2)]'
              : 'glass glass-tint-emerald text-charcoal rounded-bl-md',
          )}
        >
          {m.role === 'assistant' ? <ReactMarkdown components={MD_COMPONENTS}>{m.content}</ReactMarkdown> : m.content}
          {m.streaming && <span className="inline-block w-2 h-4 ml-1 align-middle rounded-sm bg-emerald animate-pulse" aria-hidden />}
        </div>
        {m.role === 'assistant' && !m.streaming && !m.pending && m.content.length > 40 && (
          <button
            type="button"
            onClick={() => onListen(m)}
            className={cn(
              'mt-1 ml-1 mr-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-t12 transition-all duration-200 active:scale-95',
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
              ? translate('acharya.preparingAudio')
              : audioMsgId === m.id
                ? translate('acharya.stopAudio')
                : translate('acharya.listen')}
          </button>
        )}
        {m.role === 'assistant' && !m.streaming && !m.pending && m.content.length > 40 && (
          <button
            type="button"
            onClick={() => onToggleSave(m)}
            aria-pressed={saved}
            title={saved ? translate('acharya.unsaveInsight') : translate('acharya.saveInsight')}
            className={cn(
              'mt-1 ml-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-t12 transition-all duration-180 active:scale-95',
              saved ? 'border border-gold/35 bg-gold/10 text-[#8a6d1f]' : 'border border-transparent text-muted-foreground/70 hover:border-emerald/25 hover:bg-emerald-soft/50 hover:text-emerald-deep',
            )}
          >
            <Icon name="bookmark" size={12} />
            {saved ? translate('acharya.insightSaved') : translate('acharya.saveInsight')}
          </button>
        )}
        {m.role === 'assistant' && !m.streaming && m.journalRef && (
          <button
            type="button"
            onClick={() => onViewJournal(m.journalRef!)}
            title={translate('acharya.viewJournal')}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gold-faint/60 border border-gold/30 px-2.5 py-1 text-t12 text-[#8a6d1f] hover:bg-gold-faint hover:border-gold/50 active:scale-95 transition-all duration-200"
          >
            <Icon name="journal" size={12} />
            {translate('acharya.viewJournal')}
            <span className="opacity-60">
              {new Date(`${m.journalRef}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
            </span>
            <Icon name="arrow-right" size={11} className="opacity-60" />
          </button>
        )}
      </div>
    </mot.div>
  );
});

export function AcharyaScreen() {
  const { t, i18n } = useTranslation();
  const { chart, activeChartId, user } = useSession();
  const { requireAuth } = useAuthPrompt();
  const language = useAppStore((s) => s.language);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [savedInsights, setSavedInsights] = useState<SavedInsight[]>([]);
  const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  /** True while the visible conversation came from the device cache. */
  const [fromCache, setFromCache] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [olderMessageCursor, setOlderMessageCursor] = useState<string | null>(null);
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
  const [olderMessagesError, setOlderMessagesError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const preserveScrollRef = useRef<{ height: number; top: number } | null>(null);
  const olderMessageLockRef = useRef(false);
  const atBottomRef = useRef(true);
  const requestLockRef = useRef(false);
  const pendingStreamRef = useRef<{ id: string; content: string; journalRef?: string } | null>(null);
  const streamFrameRef = useRef<number | null>(null);
  const nativeVoiceActiveRef = useRef(false);
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
  const currentScopeKey = user?.id && activeChartId ? `${user.id}|${activeChartId}` : null;
  // Never render a prior account/chart transcript for even a single frame when
  // the session or active chart changes.
  const visibleMessages = currentScopeKey && loadedScopeKey === currentScopeKey ? messages : [];
  const chatOpening = Boolean(user?.id && activeChartId && (conversationId === null || loadedScopeKey !== currentScopeKey));

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

  const handleListen = useCallback((message: Msg) => { void listenToMessage(message); }, [listenToMessage]);
  const handleViewJournal = useCallback((journalRef: string) => {
    useAppStore.getState().pushPendingFocus(`journal:${journalRef}`);
    window.dispatchEvent(new CustomEvent('ss:navigate', { detail: { tab: 'journal' } }));
  }, []);
  const translate = useCallback((key: string) => t(key), [t]);

  // Saved insights use the same private account+chart cache owner as chat history.
  useEffect(() => {
    let live = true;
    setSavedInsights([]);
    if (!user?.id || !activeChartId) return () => { live = false; };
    void readSavedInsights(user.id, activeChartId).then((items) => {
      if (live) setSavedInsights(items);
    });
    return () => { live = false; };
  }, [user?.id, activeChartId]);

  const toggleSavedInsight = useCallback(async (message: Msg) => {
    const userId = user?.id;
    const chartId = activeChartId;
    if (!userId || !chartId || message.role !== 'assistant' || !message.content.trim()) return;
    const existing = savedInsights.find((item) => item.content === message.content);
    if (existing) {
      await removeSavedInsight(userId, chartId, existing.id);
      setSavedInsights((items) => items.filter((item) => item.id !== existing.id));
      return;
    }
    const title = message.content
      .split('\n')
      .map((line) => line.replace(/^\s{0,3}#{1,6}\s*/, '').replace(/[\*_`~]/g, '').trim())
      .find(Boolean)?.slice(0, 100) || t('home.savedInsights.fallbackTitle');
    const id = (() => {
      try { return crypto.randomUUID(); } catch { return `insight-${Date.now().toString(36)}`; }
    })();
    const saved = await saveInsight({
      id,
      userId,
      chartId,
      title,
      content: message.content,
      source: 'Acharya AI',
    });
    if (saved) setSavedInsights((items) => [saved, ...items.filter((item) => item.id !== saved.id && item.content !== saved.content)].slice(0, 80));
  }, [user?.id, activeChartId, savedInsights, t]);

  // A conversation id lives only for this app session. It remains stable when
  // the user changes tabs, but a full app restart begins a fresh conversation.
  useEffect(() => {
    if (!user?.id || !activeChartId) {
      if (!user?.id) {
        // Signing out ends the in-memory session so a later sign-in starts fresh.
        sessionConversationIds.clear();
        freshConversationIds.clear();
      }
      setConversationId(null);
      setMessages([]);
      setLoadedScopeKey(null);
      setFromCache(false);
      return;
    }
    setLoadedScopeKey(null);
    setConversationId(getSessionConversationId(user.id, activeChartId));
  }, [user?.id, activeChartId]);

  /**
   * Cache-first conversation loading. Cached messages are painted immediately;
   * the server is then the source of truth. Each conversation has its own cache
   * key so switching chats cannot briefly show another transcript.
   */
  useEffect(() => {
    const userId = user?.id;
    const chartId = activeChartId;
    const selectedConversationId = conversationId;
    if (!userId || !chartId || !selectedConversationId) return;
    let cancelled = false;
    const paintT0 = start();
    const cacheConversationId = selectedConversationId === LEGACY_CONVERSATION_ID ? undefined : selectedConversationId;
    setMessages([]);
    setLoadedScopeKey(null);
    atBottomRef.current = true;
    preserveScrollRef.current = null;
    olderMessageLockRef.current = false;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setHasOlderMessages(false);
    setOlderMessageCursor(null);
    setOlderMessagesLoading(false);
    setOlderMessagesError(false);
    setFromCache(false);
    setLoadError(false);
    if (freshConversationIds.has(selectedConversationId)) {
      setLoadedScopeKey(`${userId}|${chartId}`);
      setConversationLoading(false);
      return () => { cancelled = true; };
    }
    setConversationLoading(true);
    const run = async () => {
      const cached = await readChatHistory(userId, chartId, cacheConversationId);
      if (cancelled) return;
      if (cached) {
        setMessages(cached.messages as Msg[]);
        setLoadedScopeKey(`${userId}|${chartId}`);
        setFromCache(true);
        setConversationLoading(false);
        count('cache.chat.hit');
        end('acharya.cachePaint', paintT0);
      } else {
        count('cache.chat.miss');
      }
      const netT0 = start();
      try {
        const res = await api<{ messages: Msg[]; hasMore?: boolean; nextCursor?: string | null }>(`/api/ask-acharya?conversationId=${encodeURIComponent(selectedConversationId)}`);
        if (cancelled) return;
        end('acharya.network', netT0);
        setMessages(res.messages);
        setLoadedScopeKey(`${userId}|${chartId}`);
        setHasOlderMessages(Boolean(res.hasMore));
        setOlderMessageCursor(res.nextCursor ?? null);
        setFromCache(false);
        setConversationLoading(false);
        void writeChatHistory(userId, chartId, res.messages, cacheConversationId);
      } catch {
        if (!cancelled) {
          if (!cached) setLoadedScopeKey(`${userId}|${chartId}`);
          setConversationLoading(false);
          if (!cached) setLoadError(true);
        }
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [user?.id, activeChartId, conversationId]);

  // One-shot handoff: a draft pushed by another screen (e.g. "discuss this
  // journal note" on the Journal tab) lands in the composer and gets focus.
  // The draft's journal date is kept so the NEXT exchange is threaded — the
  // Acharya reply then offers a "View journal entry" jump back to Journal.
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const journalRefDate = useRef<string | null>(null);
  const acharyaDraft = useAppStore((s) => s.acharyaDraft);
  useEffect(() => {
    const draft = useAppStore.getState().consumeAcharyaDraft();
    if (draft) {
      setInput(draft.text.slice(0, 1400));
      journalRefDate.current = draft.journalDate;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [acharyaDraft]);

  // Follow the stream only while the reader is already near the bottom.
  // Never yank the viewport away from older text, and use instant positioning
  // during streaming so each token does not trigger a smooth-scroll animation.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const anchor = preserveScrollRef.current;
    if (anchor) {
      el.scrollTop = anchor.top + (el.scrollHeight - anchor.height);
      preserveScrollRef.current = null;
      return;
    }
    if (!atBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, conversationLoading]);


  // Replace the temporary streaming id with the server id once persistence is
  // confirmed. The server response is conversation-scoped, so ids from another
  // chat can never be reconciled into the visible thread.
  const reconcileAssistantId = useCallback(async (tempId: string, content: string, selectedConversationId: string) => {
    const userId = user?.id;
    const chartId = activeChartId;
    if (!content || !userId || !chartId) return;
    const cacheConversationId = selectedConversationId === LEGACY_CONVERSATION_ID ? undefined : selectedConversationId;
    try {
      const h = await api<{ messages: Msg[]; hasMore?: boolean; nextCursor?: string | null }>(`/api/ask-acharya?conversationId=${encodeURIComponent(selectedConversationId)}`);
      void writeChatHistory(userId, chartId, h.messages, cacheConversationId);
      if (selectedConversationId === conversationId) {
        setHasOlderMessages(Boolean(h.hasMore));
        setOlderMessageCursor(h.nextCursor ?? null);
      }
      const match = [...h.messages].reverse().find((x) => x.role === 'assistant' && x.content === content);
      if (match) {
        setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, id: match.id, pending: false, createdAt: match.createdAt } : x)));
      }
    } catch {
      /* Audio is omitted until the server confirms this streamed reply. */
    }
  }, [user?.id, activeChartId, conversationId]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || requestLockRef.current) return;
      if (!requireAuth('ai')) return;
      if (!chart) {
        setLoadError(true);
        return;
      }
      const selectedConversationId = conversationId;
      if (!selectedConversationId) return;
      const priorSameQuestionCount = messages.filter((message) => message.role === 'user' && message.content === q).length;
      requestLockRef.current = true;
      freshConversationIds.delete(selectedConversationId);
      setLoadError(false);
      const reDate = journalRefDate.current;
      journalRefDate.current = null;
      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
      const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', content: q, journalRef: reDate ?? undefined };
      const assistantId = `a-${Date.now()}-s`;
      setMessages((m) => [...m, userMsg]);
      setLoading(true);
      atBottomRef.current = true;

      const upsertStreamBubble = (full: string) => {
        setMessages((m) => {
          const existing = m.find((x) => x.id === assistantId);
          if (!existing) return [...m, { id: assistantId, role: 'assistant', content: full, streaming: true, journalRef: reDate ?? undefined }];
          return m.map((x) => (x.id === assistantId ? { ...x, content: full } : x));
        });
      };
      const flushStreamFrame = () => {
        const pending = pendingStreamRef.current;
        pendingStreamRef.current = null;
        if (pending) upsertStreamBubble(pending.content);
      };
      const appendDelta = (full: string) => {
        pendingStreamRef.current = { id: assistantId, content: full, journalRef: reDate ?? undefined };
        // Coalesce fast SSE chunks to at most one React update per animation
        // frame. This reduces WebView work on older Android devices.
        if (streamFrameRef.current === null) {
          streamFrameRef.current = window.requestAnimationFrame(() => {
            streamFrameRef.current = null;
            flushStreamFrame();
          });
        }
      };
      const finishBubble = () => {
        if (streamFrameRef.current !== null) window.cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
        flushStreamFrame();
        setMessages((m) => m.map((x) => x.id === assistantId
          ? { ...x, streaming: false, pending: true, journalRef: reDate ?? undefined }
          : x));
      };
      const cacheConversationId = selectedConversationId === LEGACY_CONVERSATION_ID ? undefined : selectedConversationId;
      try {
        const res = await fetch(apiUrl('/api/ask-acharya'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: q,
            language,
            stream: true,
            journalRef: reDate ?? undefined,
            conversationId: selectedConversationId,
          }),
        });
        if (res.status === 401) {
          notifySignInRequired('ai');
          setInput(q);
          setMessages((m) => m.filter((x) => x.id !== userMsg.id));
          return;
        }
        if (!res.ok || !res.body) {
          let msg = `HTTP ${res.status}`;
          try { msg = ((await res.json()) as { error?: string }).error ?? msg; } catch { /* non-JSON error */ }
          throw new Error(msg);
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        let full = '';
        const consumeEvent = (evt: string) => {
          const line = evt.split('\n').find((l) => l.startsWith('data:'));
          if (!line) return;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') return;
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
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf('\n\n')) >= 0) {
            const evt = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            consumeEvent(evt);
          }
        }
        if (buf.trim()) consumeEvent(buf);
        finishBubble();
        const finalContent = full.trim();
        if (!finalContent) throw new Error('empty_stream');
        await reconcileAssistantId(assistantId, finalContent, selectedConversationId);
      } catch (e) {
        if (streamFrameRef.current !== null) window.cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
        pendingStreamRef.current = null;
        // Never automatically issue a second AI POST after a streaming failure:
        // the server may already have saved the user turn or completed the reply.
        // Reconcile by reading this conversation, which avoids duplicate charges
        // and duplicated user messages on flaky mobile connections.
        let recovered = false;
        try {
          const latest = await api<{ messages: Msg[]; hasMore?: boolean; nextCursor?: string | null }>(`/api/ask-acharya?conversationId=${encodeURIComponent(selectedConversationId)}`);
          const currentPromptCount = latest.messages.filter((message) => message.role === 'user' && message.content === q).length;
          if (currentPromptCount > priorSameQuestionCount) {
            setMessages(latest.messages);
            setHasOlderMessages(Boolean(latest.hasMore));
            setOlderMessageCursor(latest.nextCursor ?? null);
            void writeChatHistory(user?.id ?? '', activeChartId ?? '', latest.messages, cacheConversationId);
            let lastPromptIndex = -1;
            latest.messages.forEach((message, index) => {
              if (message.role === 'user' && message.content === q) lastPromptIndex = index;
            });
            const replySaved = lastPromptIndex >= 0
              && latest.messages.slice(lastPromptIndex + 1).some((message) => message.role === 'assistant' && message.content.trim().length > 0);
            setLoadError(!replySaved);
            recovered = true;
          }
        } catch {
          /* Keep the optimistic user turn visible and show the inline error. */
        }
        if (!recovered) {
          setMessages((current) => current.filter((message) => message.id !== assistantId));
          setLoadError(true);
        }
        console.error('[acharya stream]', e);
      } finally {
        requestLockRef.current = false;
        setLoading(false);
      }
    },
    [chart, language, conversationId, messages, reconcileAssistantId, requireAuth, user?.id, activeChartId],
  );

  const loadConversations = useCallback(async (older = false) => {
    if (!user?.id || !activeChartId || historyLoading) return;
    setHistoryLoading(true);
    setHistoryError(false);
    try {
      const before = older && historyCursor ? `&before=${encodeURIComponent(historyCursor)}` : '';
      const res = await api<{ conversations: ConversationSummary[]; nextCursor: string | null }>(`/api/ask-acharya?list=1${before}`);
      if (!older) {
        // A successful first page is authoritative; remove any cache-only rows
        // left over from an account restore or a previous server-side deletion.
        setConversations(res.conversations);
      } else {
        setConversations((current) => {
          const merged = new Map<string, ConversationSummary>(current.map((item): [string, ConversationSummary] => [item.id, item]));
          for (const item of res.conversations) {
            const existing = merged.get(item.id);
            if (!existing) merged.set(item.id, item);
            else {
              const incomingIsNewer = item.updatedAt > existing.updatedAt;
              merged.set(item.id, {
                ...existing,
                title: item.title !== 'Astrovia AI chat' ? item.title : existing.title,
                preview: incomingIsNewer ? item.preview : existing.preview,
                updatedAt: incomingIsNewer ? item.updatedAt : existing.updatedAt,
                messageCount: Math.max(existing.messageCount, item.messageCount),
              });
            }
          }
          return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        });
      }
      setHistoryCursor(res.nextCursor);
    } catch {
      setHistoryError(true);
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.id, activeChartId, historyLoading, historyCursor]);

  const loadOlderMessages = useCallback(async () => {
    const userId = user?.id;
    const chartId = activeChartId;
    const selectedConversationId = conversationId;
    const cursor = olderMessageCursor;
    if (!userId || !chartId || !selectedConversationId || !cursor || !hasOlderMessages || olderMessageLockRef.current) return;
    olderMessageLockRef.current = true;
    setOlderMessagesLoading(true);
    setOlderMessagesError(false);
    const el = scrollRef.current;
    if (el) preserveScrollRef.current = { height: el.scrollHeight, top: el.scrollTop };
    try {
      const query = `conversationId=${encodeURIComponent(selectedConversationId)}&before=${encodeURIComponent(cursor)}`;
      const page = await api<{ messages: Msg[]; hasMore?: boolean; nextCursor?: string | null }>(`/api/ask-acharya?${query}`);
      setMessages((current) => {
        const knownIds = new Set(current.map((message) => message.id));
        const older = page.messages.filter((message) => !knownIds.has(message.id));
        return older.length ? [...older, ...current] : current;
      });
      setHasOlderMessages(Boolean(page.hasMore));
      setOlderMessageCursor(page.nextCursor ?? null);
    } catch {
      preserveScrollRef.current = null;
      setOlderMessagesError(true);
    } finally {
      olderMessageLockRef.current = false;
      setOlderMessagesLoading(false);
    }
  }, [user?.id, activeChartId, conversationId, olderMessageCursor, hasOlderMessages]);

  const startNewChat = useCallback(() => {
    if (!user?.id || !activeChartId || loading || requestLockRef.current) return;
    if (conversationId) freshConversationIds.delete(conversationId);
    const nextId = makeConversationId();
    freshConversationIds.add(nextId);
    setSessionConversationId(user.id, activeChartId, nextId);
    setConversationId(nextId);
    atBottomRef.current = true;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setMessages([]);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setFromCache(false);
    setLoadError(false);
    setConversationLoading(false);
    setHistoryOpen(false);
    setFocusMode(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [user?.id, activeChartId, loading, conversationId]);

  const openHistory = useCallback(() => {
    setHistoryOpen(true);
    // Paint recent locally cached conversations immediately, while the server
    // refresh runs independently in the background.
    if (user?.id && activeChartId) {
      void readCachedChatSummaries(user.id, activeChartId).then((cached) => {
        if (cached.length) {
          setConversations((current) => current.length ? current : cached);
        }
      }).catch(() => undefined);
    }
    void loadConversations(false);
  }, [loadConversations, user?.id, activeChartId]);

  const selectConversation = useCallback((item: ConversationSummary) => {
    if (!user?.id || !activeChartId || loading || requestLockRef.current) return;
    if (conversationId) freshConversationIds.delete(conversationId);
    freshConversationIds.delete(item.id);
    setSessionConversationId(user.id, activeChartId, item.id);
    setConversationId(item.id);
    atBottomRef.current = true;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setConversationLoading(true);
    setMessages([]);
    setFromCache(false);
    setLoadError(false);
    setHistoryOpen(false);
    setFocusMode(true);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }, [user?.id, activeChartId, loading, conversationId]);

  // When a drawer or focus-reader is open, Android Back closes the topmost
  // layer first. The native listener is registered only while needed, so normal
  // Back behaviour remains untouched everywhere else in the app.
  useEffect(() => {
    if (!isNative() || (!historyOpen && !focusMode)) return;
    let cancelled = false;
    let listener: { remove: () => Promise<void> } | null = null;
    void import('@capacitor/app')
      .then(({ App }) => App.addListener('backButton', () => {
        if (historyOpen) setHistoryOpen(false);
        else if (focusMode) setFocusMode(false);
      }))
      .then((handle) => {
        if (cancelled) void handle.remove();
        else listener = handle;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (listener) void listener.remove();
    };
  }, [historyOpen, focusMode]);

  useEffect(() => {
    if (!historyOpen && !focusMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (historyOpen) setHistoryOpen(false);
      else if (focusMode) setFocusMode(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [historyOpen, focusMode]);

  const micSupported = isNative() || (typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined');

  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeVoiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    recordingTimerRef.current = null;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  // Stop microphone access and cancel any pending stream-frame work on unmount.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    if (nativeVoiceTimerRef.current) clearTimeout(nativeVoiceTimerRef.current);
    if (nativeVoiceActiveRef.current) void nativeSpeechStop();
    if (streamFrameRef.current !== null && typeof window !== 'undefined') window.cancelAnimationFrame(streamFrameRef.current);
  }, []);

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
      setInput((prev) => (prev ? `${prev} ${res.text}`.slice(0, 1400) : res.text.slice(0, 1400)));
    } catch {
      setVoiceError(true);
    } finally {
      setVoiceState('idle');
    }
  };

  const toggleMic = async () => {
    if (voiceState === 'recording') {
      if (isNative()) {
        setVoiceState('transcribing');
        void nativeSpeechStop().catch(() => undefined);
      } else {
        stopRecording();
      }
      return;
    }
    if (voiceState !== 'idle') return;
    if (!requireAuth('ai')) return;
    setVoiceError(false);
    // Native recognition now stays inline (popup:false in the Capacitor bridge).
    // The same microphone button ends listening, then inserts the transcript.
    if (isNative()) {
      nativeVoiceActiveRef.current = true;
      setVoiceState('recording');
      nativeVoiceTimerRef.current = setTimeout(() => {
        setVoiceState('transcribing');
        void nativeSpeechStop().catch(() => undefined);
      }, 60_000);
      try {
        const text = await nativeSpeechTranscribe(language);
        if (text) setInput((prev) => (prev ? `${prev} ${text}`.slice(0, 1400) : text.slice(0, 1400)));
        else setVoiceError(true);
      } catch {
        setVoiceError(true);
      } finally {
        nativeVoiceActiveRef.current = false;
        if (nativeVoiceTimerRef.current) clearTimeout(nativeVoiceTimerRef.current);
        nativeVoiceTimerRef.current = null;
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
      recordingTimerRef.current = setTimeout(() => stopRecording(), 60000);
    } catch {
      setVoiceError(true);
      setVoiceState('idle');
    }
  };

  const groupedConversations = {
    today: conversations.filter((item) => conversationGroupId(item.updatedAt) === 'today'),
    yesterday: conversations.filter((item) => conversationGroupId(item.updatedAt) === 'yesterday'),
    older: conversations.filter((item) => conversationGroupId(item.updatedAt) === 'older'),
  };
  const activeConversationTitle = conversations.find((item) => item.id === conversationId)?.title;

  return (
    <>
    <div className={cn(
      'flex flex-col text-charcoal',
      focusMode
        ? 'fixed inset-0 z-[70] bg-cream px-3 pt-[max(0.5rem,env(safe-area-inset-top))]'
        : 'h-[calc(100dvh-8rem-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-4.5rem)]',
    )} data-testid="acharya-chat-shell">
      {/* Premium AI header: subtle layered colour, clear chat controls, no heavy blur. */}
      <div className={cn(
        'glass glass-tint-emerald bar-texture rounded-[22px] px-3 sm:px-4 py-2.5 flex items-center gap-2.5 shrink-0 relative overflow-hidden',
        focusMode && 'rounded-[20px]',
      )}>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-emerald/10 via-transparent to-gold/10" aria-hidden="true" />
        <button
          type="button"
          onClick={() => focusMode ? setFocusMode(false) : openHistory()}
          aria-label={focusMode ? t('acharya.exitFocus') : t('acharya.history')}
          className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/45 text-emerald-deep transition-colors duration-200 hover:bg-white/75 active:scale-95"
        >
          <Icon name={focusMode ? 'arrow-left' : 'list'} size={19} />
        </button>
        {focusMode && (
          <button
            type="button"
            onClick={openHistory}
            aria-label={t('acharya.history')}
            title={t('acharya.history')}
            className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/40 text-emerald-deep transition-colors duration-200 hover:bg-white/75 active:scale-95"
          >
            <Icon name="list" size={17} />
          </button>
        )}
        <AcharyaAvatar size={focusMode ? 38 : 42} className="relative shrink-0" />
        <div className="flex-1 min-w-0 relative">
          <p className="font-serif text-t15 sm:text-t16 font-semibold text-emerald-grad truncate">
            {focusMode ? (activeConversationTitle || t('acharya.historyTitle')) : t('acharya.title')}
          </p>
          <p className="text-t12 text-muted-foreground flex items-center gap-1.5 truncate">
            <span className="inline-block w-1.5 h-1.5 shrink-0 rounded-full bg-violet" />
            {t('acharya.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={startNewChat}
          disabled={loading || conversationId === null}
          aria-label={t('acharya.newChat')}
          title={t('acharya.newChat')}
          className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald/15 to-gold/15 text-emerald-deep transition-all duration-200 hover:border-emerald/40 hover:from-emerald/20 hover:to-gold/25 active:scale-95 disabled:opacity-40"
        >
          <Icon name="plus" size={19} />
        </button>
      </div>

      {/* Messages — one centered conversation column (readable width on
          desktop, full-bleed on mobile) */}
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-slim px-1 py-4', focusMode && 'px-1 sm:px-4 sm:py-6')}
      >
        <div className={cn('mx-auto w-full max-w-3xl space-y-4', focusMode && 'max-w-4xl space-y-6')}>
        {hasOlderMessages && (
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={() => void loadOlderMessages()}
              disabled={olderMessagesLoading}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald/15 bg-white/65 px-3.5 py-2 text-t12 font-medium text-emerald-deep shadow-[0_2px_10px_rgba(42,36,32,0.03)] transition-colors duration-150 hover:bg-white disabled:opacity-60"
            >
              {olderMessagesLoading
                ? <span className="astro-chat-orbit astro-chat-orbit-sm" aria-hidden="true"><span /></span>
                : <Icon name={olderMessagesError ? 'refresh' : 'chevron-up'} size={14} />}
              {olderMessagesLoading
                ? t('acharya.loadingOlderMessages')
                : olderMessagesError ? t('common.retry') : t('acharya.loadOlderMessages')}
            </button>
          </div>
        )}

        {fromCache && visibleMessages.length > 0 && (
          <p
            className="text-center text-t12 text-muted-foreground/80"
            role="status"
            data-testid="acharya-cached-badge"
          >
            {t('acharya.savedOnDevice')}
          </p>
        )}
        {visibleMessages.length === 0 && (conversationLoading || chatOpening) && (
          <div className="flex min-h-[38vh] flex-col items-center justify-center gap-3 px-4 text-center" role="status" aria-live="polite">
            <div className="astro-chat-orbit" aria-hidden="true"><span /></div>
            <p className="text-t12 text-muted-foreground">{t('acharya.loadingConversation')}</p>
          </div>
        )}

        {visibleMessages.length === 0 && !conversationLoading && !chatOpening && (
          <div className="text-center px-4 pt-6 sm:pt-10">
            <AcharyaAvatar size={focusMode ? 84 : 96} className="mx-auto mb-3" />
            <p className={cn('text-t14 text-charcoal/80 leading-relaxed max-w-md mx-auto', focusMode && 'text-[15px] sm:text-base')}>{chart ? t('acharya.welcome') : t('acharya.needChart')}</p>
            {chart && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTION_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => ask(t(k))}
                    className="tap-sm inline-flex min-h-[44px] items-center rounded-full border border-emerald/30 bg-gradient-to-r from-white/70 to-emerald-soft/70 px-4 py-2 text-t12 font-medium text-emerald-deep shadow-[0_4px_14px_rgba(42,36,32,0.04)] hover:border-emerald/55 hover:from-white/90 hover:to-emerald-soft transition-colors duration-200"
                  >
                    {t(k)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {visibleMessages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              focusMode={focusMode}
              audioMsgId={audioMsgId}
              audioLoadingId={audioLoadingId}
              locale={i18n.language === 'hi' ? 'hi-IN' : 'en-IN'}
              translate={translate}
              onListen={handleListen}
              onViewJournal={handleViewJournal}
              saved={savedInsights.some((item) => item.content === m.content)}
              onToggleSave={toggleSavedInsight}
            />
          ))}
        </AnimatePresence>

        {loading && !visibleMessages.some((m) => m.streaming) && (
          <mot.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
            <AcharyaAvatar size={30} className="shrink-0 hidden sm:block" />
            <div className="glass glass-tint-emerald rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2.5">
              <div className="astro-chat-orbit astro-chat-orbit-sm" aria-hidden="true"><span /></div>
              <p className="text-t12 text-muted-foreground">{t('acharya.thinking')}</p>
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
        className="shrink-0 pt-3"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        <div
          className={cn(
            'glass glass-tint-emerald mx-auto w-full max-w-3xl rounded-[26px] border-0 px-1.5 py-1.5',
            'shadow-[0_12px_36px_rgba(42,36,32,0.12)] transition-all duration-250',
            'focus-within:border-0 focus-within:shadow-[0_14px_40px_rgba(62,142,110,0.18)]',
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
                <Icon name={voiceState === 'recording' ? 'mic-off' : 'mic'} size={19} />
              </button>
            )}
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 1400))}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              placeholder={chart ? (voiceState === 'transcribing' ? t('acharya.voiceHint') : t('acharya.placeholder')) : t('acharya.needChart')}
              disabled={!chart || loading}
              className="astro-ai-textarea min-h-11 max-h-28 min-w-0 flex-1 bg-transparent px-1.5 py-2.5 text-t14 text-charcoal placeholder:text-muted-foreground/60 outline-none"
              maxLength={1400}
              aria-label={t('acharya.placeholder')}
            />
            <GoldButton type="submit" disabled={!input.trim() || loading || !chart} className="h-11 w-11 shrink-0 !px-0 hover:translate-y-0">
              <Icon name="send" size={18} />
              <span className="sr-only">{t('acharya.placeholder')}</span>
            </GoldButton>
          </div>
        </div>
      </form>
    </div>

    <AnimatePresence>
      {historyOpen && (
        <>
          <mot.div
            key="acharya-history-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[90] bg-[#241f1b]/30"
            aria-hidden="true"
            onClick={() => setHistoryOpen(false)}
          />
          <mot.aside
            key="acharya-history-drawer"
            initial={{ x: '-100%', opacity: 0.98 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[91] flex w-full flex-col bg-[#fbf8f0] shadow-[0_18px_50px_rgba(36,31,27,0.14)]"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
            role="dialog"
            aria-modal="true"
            aria-label={t('acharya.historyTitle')}
          >
            <div className="relative flex items-center gap-3 px-4 pb-4 pt-3">
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label={t('common.back')}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/65 text-emerald-deep transition-colors duration-150 hover:bg-white active:scale-95"
              >
                <Icon name="arrow-left" size={19} />
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald/15 to-gold/20 text-emerald-deep">
                <Icon name="chat" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-t16 font-semibold text-emerald-grad">{t('acharya.historyTitle')}</p>
                <p className="text-t12 text-muted-foreground">{t('acharya.history')}</p>
              </div>
              <button
                type="button"
                onClick={startNewChat}
                disabled={loading}
                aria-label={t('acharya.newChat')}
                title={t('acharya.newChat')}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald text-white shadow-[0_5px_15px_rgba(46,112,87,0.2)] transition-transform duration-200 active:scale-95 disabled:opacity-40"
              >
                <Icon name="plus" size={19} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-slim px-3 py-3">
              {historyLoading && conversations.length === 0 && (
                <div className="flex flex-col items-center gap-3 px-5 py-10 text-center" role="status" aria-live="polite">
                  <div className="astro-chat-orbit" aria-hidden="true"><span /></div>
                  <p className="text-t12 text-muted-foreground">{t('acharya.historyLoading')}</p>
                </div>
              )}

              {historyError && (
                <div className="mx-1 mb-3 rounded-2xl border border-rose/20 bg-rose/5 px-3 py-3 text-t12 text-maroon">
                  <p>{t('acharya.historyError')}</p>
                  <button type="button" onClick={() => void loadConversations(false)} disabled={historyLoading} className="mt-2 font-semibold underline underline-offset-2 disabled:opacity-50">
                    {t('common.retry')}
                  </button>
                </div>
              )}

              {!historyLoading && conversations.length === 0 && !historyError && (
                <div className="px-4 py-10 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-white to-gold/10 text-gold">
                    <Icon name="lotus" size={25} />
                  </div>
                  <p className="text-t14 font-semibold text-charcoal">{t('acharya.noHistory')}</p>
                  <p className="mt-1.5 text-t12 leading-relaxed text-muted-foreground">{t('acharya.noHistoryHint')}</p>
                </div>
              )}

              {(['today', 'yesterday', 'older'] as const).map((group) => groupedConversations[group].length > 0 && (
                <section key={group} className="mb-4">
                  <h3 className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">{t(`acharya.${group}`)}</h3>
                  <div className="space-y-1">
                    {groupedConversations[group].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectConversation(item)}
                        disabled={loading || requestLockRef.current}
                        className={cn(
                          'group flex w-full items-start gap-2.5 rounded-2xl px-3 py-3 text-left transition-colors duration-150 active:scale-[0.99] disabled:opacity-50',
                          conversationId === item.id
                            ? 'bg-emerald-soft/75'
                            : 'hover:bg-white/75',
                        )}
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/80 text-emerald-deep shadow-[inset_0_0_0_1px_rgba(46,112,87,0.08)]">
                          <Icon name="chat" size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-t13 font-semibold text-charcoal">{item.title || t('acharya.history')}</span>
                          <span className="mt-1 block truncate text-t12 leading-relaxed text-muted-foreground">{item.preview}</span>
                        </span>
                        <Icon name="chevron-right" size={14} className="mt-1 shrink-0 text-muted-foreground/50 transition-transform duration-150 group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}

              {historyCursor && (
                <button
                  type="button"
                  onClick={() => void loadConversations(true)}
                  disabled={historyLoading}
                  className="mx-1 mt-1 flex min-h-11 w-[calc(100%-0.5rem)] items-center justify-center gap-2 rounded-xl bg-white/65 px-3 text-t12 font-semibold text-emerald-deep transition-colors duration-150 hover:bg-white disabled:opacity-50"
                >
                  {historyLoading ? <span className="astro-chat-orbit astro-chat-orbit-sm" aria-hidden="true"><span /></span> : <Icon name="chevron-down" size={14} />}
                  {t('acharya.loadOlder')}
                </button>
              )}
            </div>
          </mot.aside>
        </>
      )}
    </AnimatePresence>
    </>
  );
}
