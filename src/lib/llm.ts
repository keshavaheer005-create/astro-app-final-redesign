// Backend-only LLM client for NVIDIA NIM (OpenAI-compatible). NEVER import from client code:
// the API key lives in process.env.NVIDIA_API_KEY and must not reach the browser.

export type LlmMsg = { role: 'system' | 'user' | 'assistant'; content: string };

const baseUrl = () => (process.env.NIM_BASE_URL?.trim() || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
export const nimKey = () => process.env.NVIDIA_API_KEY?.trim() || '';
export const nimConfigured = () => nimKey().length > 0;

/** Main Acharya chat model — chosen by `node scripts/eval-nim.mjs` (96-100% accurate, fastest of the accurate ones). */
export const acharyaModel = () => process.env.ACHARYA_MODEL?.trim() || 'nvidia/nemotron-3-super-120b-a12b';
/** Small/fast model for one-line notes (micro-notes, festival blurbs, pattern insight). */
export const fastModel = () => process.env.ACHARYA_FAST_MODEL?.trim() || 'nvidia/nemotron-3-super-120b-a12b';
/** Used automatically if the primary model errors, times out or is rate limited. */
const fallbackModel = () => process.env.ACHARYA_FALLBACK_MODEL?.trim() || 'nvidia/nemotron-3-ultra-550b-a55b';

const HEADER_TIMEOUT_MS = 25_000;

/** Remove reasoning blocks some models emit (<think>…</think>). */
export function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[\s\S]*?<\/think>/, '').trim();
}

/** Streaming-safe filter that drops <think>…</think> spans even when tags are split across chunks. */
export class ThinkFilter {
  private buf = '';
  private inThink = false;
  private static OPEN = '<think>';
  private static CLOSE = '</think>';

  private static partial(buf: string, tag: string): number {
    for (let k = Math.min(tag.length - 1, buf.length); k > 0; k--) if (buf.endsWith(tag.slice(0, k))) return k;
    return 0;
  }

  push(chunk: string): string {
    this.buf += chunk;
    let out = '';
    for (;;) {
      if (this.inThink) {
        const i = this.buf.indexOf(ThinkFilter.CLOSE);
        if (i < 0) {
          this.buf = this.buf.slice(-(ThinkFilter.CLOSE.length - 1));
          return out;
        }
        this.buf = this.buf.slice(i + ThinkFilter.CLOSE.length);
        this.inThink = false;
        continue;
      }
      const i = this.buf.indexOf(ThinkFilter.OPEN);
      if (i >= 0) {
        out += this.buf.slice(0, i);
        this.buf = this.buf.slice(i + ThinkFilter.OPEN.length);
        this.inThink = true;
        continue;
      }
      const keep = ThinkFilter.partial(this.buf, ThinkFilter.OPEN);
      out += this.buf.slice(0, this.buf.length - keep);
      this.buf = this.buf.slice(this.buf.length - keep);
      return out;
    }
  }

  flush(): string {
    const rest = this.inThink ? '' : this.buf;
    this.buf = '';
    return rest;
  }
}

/** Nemotron models reason by default; "/no_think" in the system prompt switches that off (much faster). */
function withModelTweaks(model: string, messages: LlmMsg[]): LlmMsg[] {
  if (/nemotron/i.test(model) && messages[0]?.role === 'system' && !messages[0].content.startsWith('/no_think')) {
    return [{ role: 'system', content: `/no_think\n${messages[0].content}` }, ...messages.slice(1)];
  }
  return messages;
}

/**
 * Reasoning models (Nemotron 3, gpt-oss, DeepSeek, Kimi, Qwen3, GLM…) otherwise spend the whole token
 * budget thinking and return empty/slow answers. First variant switches thinking off; if the server
 * rejects the extra field (HTTP 400) we retry with a plain request.
 */
function thinkingOff(model: string): Record<string, unknown>[] {
  if (/nemotron/i.test(model)) return [{ chat_template_kwargs: { enable_thinking: false } }, {}];
  if (/gpt-oss/i.test(model)) return [{ reasoning_effort: 'low' }, {}];
  if (/deepseek|kimi|qwen3|glm|minimax/i.test(model)) return [{ chat_template_kwargs: { thinking: false, enable_thinking: false } }, {}];
  return [{}];
}
const variantByModel = new Map<string, number>();

async function post(body: Record<string, unknown>, stream: boolean): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEADER_TIMEOUT_MS);
  try {
    return await fetch(`${baseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${nimKey()}`,
        'Content-Type': 'application/json',
        Accept: stream ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

const retryable = (status: number) => status === 429 || status >= 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Try primary model (with one retry on 429/5xx/timeouts), then the fallback model. */
async function request(opts: { messages: LlmMsg[]; model: string; maxTokens: number; temperature: number; stream: boolean }): Promise<Response | null> {
  const models = [opts.model, ...(fallbackModel() && fallbackModel() !== opts.model ? [fallbackModel()] : [])];
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const variants = thinkingOff(model);
        let vi = variantByModel.get(model) ?? 0;
        let res = await post(
          { model, messages: withModelTweaks(model, opts.messages), max_tokens: opts.maxTokens, temperature: opts.temperature, top_p: 0.9, stream: opts.stream, ...variants[vi] },
          opts.stream,
        );
        if (res.status === 400 && vi < variants.length - 1) {
          vi = variants.length - 1; // server rejected the thinking-off field → remember and retry plain
          variantByModel.set(model, vi);
          res = await post(
            { model, messages: withModelTweaks(model, opts.messages), max_tokens: opts.maxTokens, temperature: opts.temperature, top_p: 0.9, stream: opts.stream, ...variants[vi] },
            opts.stream,
          );
        }
        if (res.ok) return res;
        const detail = (await res.text().catch(() => '')).slice(0, 200);
        console.error(`[llm] ${model} → HTTP ${res.status} ${detail}`);
        if (res.status === 401 || res.status === 403) return null; // bad key: retrying won't help
        if (!retryable(res.status)) break; // e.g. 404 unknown model → try next model
        await sleep(700 * (attempt + 1));
      } catch (e) {
        console.error(`[llm] ${model} request failed:`, (e as Error).message);
        await sleep(400);
      }
    }
  }
  return null;
}

/** Non-streaming completion. Returns null on any failure so callers can use their fallback text. */
export async function nimComplete(opts: { messages: LlmMsg[]; model?: string; maxTokens?: number; temperature?: number }): Promise<string | null> {
  const res = await request({ messages: opts.messages, model: opts.model ?? acharyaModel(), maxTokens: opts.maxTokens ?? 700, temperature: opts.temperature ?? 0.6, stream: false });
  if (!res) return null;
  try {
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = stripThink(json.choices?.[0]?.message?.content ?? '');
    return text || null;
  } catch {
    return null;
  }
}

/** Streaming completion: returns the raw OpenAI-style SSE body, or null on failure. */
export async function nimStream(opts: { messages: LlmMsg[]; model?: string; maxTokens?: number; temperature?: number }): Promise<ReadableStream<Uint8Array> | null> {
  const res = await request({ messages: opts.messages, model: opts.model ?? acharyaModel(), maxTokens: opts.maxTokens ?? 900, temperature: opts.temperature ?? 0.6, stream: true });
  return res?.body ?? null;
}

/** One tiny call for /api/acharya-health. */
export async function nimPing(): Promise<{ ok: boolean; model: string; ms: number; status?: string }> {
  const model = acharyaModel();
  const t0 = Date.now();
  if (!nimConfigured()) return { ok: false, model, ms: 0, status: 'NVIDIA_API_KEY is not set' };
  try {
    const res = await post({ model, messages: [{ role: 'user', content: 'Reply with the single word: ready' }], max_tokens: 8, temperature: 0, stream: false }, false);
    return { ok: res.ok, model, ms: Date.now() - t0, status: res.ok ? 'ok' : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, model, ms: Date.now() - t0, status: (e as Error).message };
  }
}
