import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUser, memberGuard } from '@/lib/session';
import { getActiveChart } from '@/lib/active-chart';
import { compactChartContext, ComputedChart } from '@/lib/astro/chart';
import { computeChartCached as computeChart } from '@/lib/astro/chart-cache';
import { acharyaReply, acharyaStreamReply, type ChatTurn } from '@/lib/ai';
import { moonNakshatraNow } from '@/lib/astro/horoscope';
import { sadeSati } from '@/lib/astro/doshas';

export const runtime = 'nodejs';
export const maxDuration = 60;


const LEGACY_CONVERSATION_ID = 'legacy';
const CONVERSATION_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;

type ChatMeta = { conversationId?: string; journalRef?: string; title?: string };

function readChatMeta(meta: string | null | undefined): ChatMeta {
  if (!meta) return {};
  try {
    const parsed = JSON.parse(meta) as ChatMeta;
    return {
      ...(typeof parsed.conversationId === 'string' ? { conversationId: parsed.conversationId } : {}),
      ...(typeof parsed.title === 'string' && parsed.title.trim()
        ? { title: cleanTitle(parsed.title) }
        : {}),
      ...(typeof parsed.journalRef === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.journalRef)
        ? { journalRef: parsed.journalRef }
        : {}),
    };
  } catch {
    return {};
  }
}

function normalizeConversationId(value: unknown): string {
  if (value === LEGACY_CONVERSATION_ID) return LEGACY_CONVERSATION_ID;
  return typeof value === 'string' && CONVERSATION_ID_RE.test(value) ? value : LEGACY_CONVERSATION_ID;
}

function conversationMeta(conversationId: string, journalRef?: unknown, title?: string): string | null {
  const meta: ChatMeta = {};
  // Keep conversationId as the first property: conversationWhere() can safely
  // use this exact, character-restricted value with the existing String field.
  if (conversationId !== LEGACY_CONVERSATION_ID) meta.conversationId = conversationId;
  if (conversationId !== LEGACY_CONVERSATION_ID && title?.trim()) meta.title = cleanTitle(title);
  if (typeof journalRef === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(journalRef)) meta.journalRef = journalRef;
  return Object.keys(meta).length ? JSON.stringify(meta) : null;
}

/** The old transcript remains available as the special legacy conversation. */
function conversationWhere(conversationId: string) {
  if (conversationId === LEGACY_CONVERSATION_ID) {
    return { OR: [{ meta: null }, { NOT: { meta: { contains: '"conversationId"' } } }] };
  }
  // IDs are character-restricted above; this uses existing metadata and avoids
  // a production schema migration for the first release of multi-chat history.
  return { meta: { contains: `"conversationId":"${conversationId}"` } };
}

function cleanTitle(content: string): string {
  const title = content.replace(/\s+/g, ' ').trim();
  return title.length > 72 ? `${title.slice(0, 69).trimEnd()}…` : title;
}

/** POST /api/ask-acharya — body { question, language?, stream? } (chart pulled from saved primary chart) */
export async function POST(req: Request) {
  try {
    const blocked = await memberGuard('ai');
    if (blocked) return blocked;
    const user = await ensureUser();
    const body = (await req.json()) as {
      question?: unknown;
      language?: unknown;
      stream?: unknown;
      journalRef?: unknown;
      conversationId?: unknown;
    };
    const { question, language, stream, journalRef } = body;
    const q = String(question ?? '').trim();
    if (!q) return NextResponse.json({ error: 'empty_question' }, { status: 400 });
    // Contextual Ask AI handoffs may include a planet/house placement or a
    // short matching/Panchang summary. Bound user input to keep model cost and
    // latency predictable even when a client bypasses the composer limit.
    if (q.length > 1400) return NextResponse.json({ error: 'question_too_long', maxLength: 1400 }, { status: 400 });
    const lang = language === 'hi' ? 'hi' : 'en';
    const conversationId = normalizeConversationId(body.conversationId);
    // Conversation identity, stable title and journal threading share the
    // existing meta field; no production DB migration is required.

    const saved = await getActiveChart(user.id);
    if (!saved) {
      return NextResponse.json({ error: 'no_chart' }, { status: 400 });
    }
    const chart: ComputedChart = computeChart({
      name: saved.name,
      dob: saved.dob,
      tob: saved.tob,
      lat: saved.lat,
      lng: saved.lng,
      timezone: saved.timezone,
      placeName: saved.placeName ?? undefined,
    });

    // Journal context: last 14 check-ins + any saved reflections
    const checkins = await db.dailyCheckIn.findMany({
      where: { chartId: saved.id },
      orderBy: { date: 'desc' },
      take: 14,
    });
    const reflections = await db.weeklyReflection.findMany({
      where: { chartId: saved.id },
      orderBy: { weekStartDate: 'desc' },
      take: 1,
    });

    const moon = chart.planets.find((p) => p.key === 'Mo')!;
    const ss = sadeSati(moon.lon, new Date());
    const nak = moonNakshatraNow(new Date());
    const journalContext = [
      ...checkins.map((c) => {
        let snap: { mahaLord?: string; antarLord?: string } = {};
        try { snap = c.dashaPeriodSnapshot ? JSON.parse(c.dashaPeriodSnapshot) : {}; } catch { /* */ }
        return `${c.date}: mood ${c.moodScore}/5${c.energyScore ? `, energy ${c.energyScore}/5` : ''}${snap.mahaLord ? ` (during ${snap.mahaLord} mahadasha${snap.antarLord ? `, ${snap.antarLord} antardasha` : ''})` : ''}${c.note ? ` — note: "${c.note}"` : ''}`;
      }),
      reflections[0] ? `Latest weekly reflection (week of ${reflections[0].weekStartDate}): "${reflections[0].reflectionText.slice(0, 220)}…"` : '',
    ].filter(Boolean).join('\n');

    const chartContext = `${compactChartContext(chart)}
Transit context: natal Moon in ${chart.moonSign.name}; current Moon nakshatra ${nak.name}; Sade Sati ${ss.active ? `ACTIVE (${ss.phase} phase)` : 'not active'}.`;

    const history = await db.chatMessage.findMany({
      where: { chartId: saved.id, userId: user.id, ...conversationWhere(conversationId) },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    const turns: ChatTurn[] = history
      .slice()
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const stableTitle = conversationId === LEGACY_CONVERSATION_ID
      ? undefined
      : history.map((m) => readChatMeta(m.meta).title).find((title): title is string => Boolean(title)) ?? cleanTitle(q);
    const metaJson = conversationMeta(conversationId, journalRef, stableTitle);

    // Personal context that goes into every prompt: who is asking, and what "today" is for them.
    const tz = saved.timezone && /[A-Za-z]+\/[A-Za-z_]+/.test(saved.timezone) ? saved.timezone : 'Asia/Kolkata';
    let nowLine = new Date().toDateString();
    try {
      nowLine = new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: tz }).format(new Date()) + ` (${tz})`;
    } catch { /* keep default */ }
    const born = new Date(`${saved.dob}T00:00:00Z`);
    const age = Number.isNaN(born.getTime()) ? null : Math.floor((Date.now() - born.getTime()) / 31_557_600_000);
    const profileContext = [
      `Name: ${saved.name}`,
      age != null ? `age ${age}` : '',
      `born ${saved.dob} at ${saved.tob}`,
      saved.placeName ? `born in ${saved.placeName}` : '',
      `Lagna ${chart.ascendant.signName}, Moon sign ${chart.moonSign.name}`,
      chart.dashaSnapshot ? `running ${chart.dashaSnapshot.mahaLord} mahadasha / ${chart.dashaSnapshot.antarLord ?? '—'} antardasha` : '',
      `prefers ${lang === 'hi' ? 'Hindi' : 'English'}`,
    ].filter(Boolean).join('; ');

    const grounding = {
      profileContext,
      nowLine,
      question: q,
      chartContext,
      journalContext,
      history: turns,
      language: lang as 'en' | 'hi',
    };

    if (stream) {
      // Persist the user turn now; the assistant turn is saved when the stream completes.
      await db.chatMessage.create({
        data: { userId: user.id, chartId: saved.id, role: 'user', content: q, ...(metaJson ? { meta: metaJson } : {}) },
      });
      const { stream: wire, done } = await acharyaStreamReply(grounding);
      // Attach a rejection observer immediately in case the consumer disconnects
      // before the wire reaches its terminal chunk. Awaiting the same promise
      // below still preserves the real result/error.
      void done.catch(() => undefined);
      const wireReader = wire.getReader();
      // Do not let the client observe stream completion until the assistant
      // message has been committed. This removes the old race where the next
      // GET could run before the streaming reply was written to the database.
      const persistedWire = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const item = await wireReader.read();
            if (!item.done) {
              if (item.value) controller.enqueue(item.value);
              return;
            }
            try {
              const full = await done;
              if (full && full.trim()) {
                await db.chatMessage.create({
                  data: { userId: user.id, chartId: saved.id, role: 'assistant', content: full.trim(), ...(metaJson ? { meta: metaJson } : {}) },
                });
              }
            } catch (e) {
              console.error('[ask-acharya] persist-after-stream:', (e as Error).message);
            }
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        },
        async cancel(reason) {
          try { await wireReader.cancel(reason); } catch { /* stream already closed */ }
        },
      });
      return new Response(persistedWire, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const answer = await acharyaReply(grounding);

    await db.chatMessage.create({
      data: { userId: user.id, chartId: saved.id, role: 'user', content: q, ...(metaJson ? { meta: metaJson } : {}) },
    });
    await db.chatMessage.create({
      data: { userId: user.id, chartId: saved.id, role: 'assistant', content: answer, ...(metaJson ? { meta: metaJson } : {}) },
    });

    return NextResponse.json({ answer });
  } catch (e) {
    console.error('[ask-acharya]', e);
    return NextResponse.json({ error: 'acharya_failed' }, { status: 500 });
  }
}


/**
 * GET /api/ask-acharya?conversationId=<id> — one conversation.
 * GET /api/ask-acharya?list=1 — recent conversation summaries for the drawer.
 * Existing messages without a conversation id appear in the special `legacy` chat.
 */
export async function GET(req: Request) {
  try {
    const user = await ensureUser();
    const active = await getActiveChart(user.id);
    const params = new URL(req.url).searchParams;
    if (!active) {
      return NextResponse.json(params.get('list') === '1'
        ? { conversations: [], nextCursor: null }
        : { messages: [] });
    }

    if (params.get('list') === '1') {
      // Roughly 10–20 short conversations on initial open; longer threads can
      // span pages without loading the account's entire history at once.
      const limit = 40;
      const beforeValue = params.get('before');
      let before: { createdAt: Date; id?: string } | null = null;
      if (beforeValue) {
        try {
          const parsed = JSON.parse(beforeValue) as { createdAt?: unknown; id?: unknown };
          const createdAt = typeof parsed.createdAt === 'string' ? new Date(parsed.createdAt) : new Date(Number.NaN);
          if (!Number.isNaN(createdAt.getTime())) {
            before = { createdAt, ...(typeof parsed.id === 'string' && parsed.id ? { id: parsed.id } : {}) };
          }
        } catch {
          // Accept the ISO-only cursor used by an older client version too.
          const createdAt = new Date(beforeValue);
          if (!Number.isNaN(createdAt.getTime())) before = { createdAt };
        }
      }
      const rows = await db.chatMessage.findMany({
        where: {
          chartId: active.id,
          userId: user.id,
          ...(before ? {
            OR: [
              { createdAt: { lt: before.createdAt } },
              ...(before.id ? [{ createdAt: before.createdAt, id: { lt: before.id } }] : []),
            ],
          } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: { id: true, role: true, content: true, meta: true, createdAt: true },
      });
      const grouped = new Map<string, {
        id: string;
        title: string;
        preview: string;
        updatedAt: string;
        titleAt: number;
        messageCount: number;
      }>();
      for (const row of rows) {
        const meta = readChatMeta(row.meta);
        const id = meta.conversationId ?? LEGACY_CONVERSATION_ID;
        const createdAt = row.createdAt.toISOString();
        const current = grouped.get(id);
        if (!current) {
          grouped.set(id, {
            id,
            title: meta.title ?? (row.role === 'user' ? cleanTitle(row.content) : 'Astrovia AI chat'),
            preview: cleanTitle(row.content),
            updatedAt: createdAt,
            titleAt: row.role === 'user' ? row.createdAt.getTime() : Number.POSITIVE_INFINITY,
            messageCount: 1,
          });
        } else {
          current.messageCount += 1;
          // Rows arrive newest first; the earliest user prompt is the title.
          if (meta.title) {
            current.title = meta.title;
          } else if (!current.title || current.title === 'Astrovia AI chat') {
            if (row.role === 'user') {
              current.title = cleanTitle(row.content);
              current.titleAt = row.createdAt.getTime();
            }
          } else if (row.role === 'user' && row.createdAt.getTime() < current.titleAt) {
            current.title = cleanTitle(row.content);
            current.titleAt = row.createdAt.getTime();
          }
        }
      }
      const conversations = [...grouped.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(({ titleAt: _titleAt, ...item }) => item);
      const lastRow = rows[rows.length - 1];
      const nextCursor = rows.length === limit && lastRow
        ? JSON.stringify({ createdAt: lastRow.createdAt.toISOString(), id: lastRow.id })
        : null;
      return NextResponse.json({ conversations, nextCursor });
    }

    const conversationId = normalizeConversationId(params.get('conversationId'));
    const MESSAGE_PAGE_SIZE = 40;
    let beforeCursor: { createdAt: Date; id: string } | null = null;
    const beforeValue = params.get('before');
    if (beforeValue) {
      try {
        const parsed = JSON.parse(beforeValue) as { createdAt?: unknown; id?: unknown };
        const createdAt = typeof parsed.createdAt === 'string' ? new Date(parsed.createdAt) : new Date(Number.NaN);
        if (!Number.isNaN(createdAt.getTime()) && typeof parsed.id === 'string' && parsed.id.length > 0) {
          beforeCursor = { createdAt, id: parsed.id };
        }
      } catch {
        /* An invalid cursor simply requests the latest page. */
      }
    }
    const msgs = await db.chatMessage.findMany({
      where: {
        chartId: active.id,
        userId: user.id,
        // AND is intentional here: the legacy-conversation filter itself uses
        // OR, and the pagination cursor needs a separate OR branch as well.
        AND: [
          conversationWhere(conversationId),
          ...(beforeCursor ? [{
            OR: [
              { createdAt: { lt: beforeCursor.createdAt } },
              { createdAt: beforeCursor.createdAt, id: { lt: beforeCursor.id } },
            ],
          }] : []),
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MESSAGE_PAGE_SIZE + 1,
    });
    const hasMore = msgs.length > MESSAGE_PAGE_SIZE;
    if (hasMore) msgs.pop();
    const lastOnPage = msgs[msgs.length - 1];
    const nextCursor = hasMore && lastOnPage
      ? JSON.stringify({ createdAt: lastOnPage.createdAt.toISOString(), id: lastOnPage.id })
      : null;
    msgs.reverse();
    return NextResponse.json({
      messages: msgs.map((m) => {
        const meta = readChatMeta(m.meta);
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          ...(meta.journalRef ? { journalRef: meta.journalRef } : {}),
        };
      }),
      hasMore,
      nextCursor,
    });
  } catch (e) {
    console.error('[ask-acharya GET]', e);
    return NextResponse.json({ messages: [], conversations: [], nextCursor: null });
  }
}
