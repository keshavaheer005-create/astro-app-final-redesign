import { NextResponse } from 'next/server';
import { nimConfigured, nimPing, acharyaModel, fastModel } from '@/lib/llm';

export const runtime = 'nodejs';

/** GET /api/acharya-health — confirms the backend can reach the LLM. Never returns the key. */
export async function GET() {
  const ping = await nimPing();
  return NextResponse.json({
    provider: nimConfigured() ? 'nvidia-nim' : 'legacy-zai',
    keyConfigured: nimConfigured(),
    model: acharyaModel(),
    fastModel: fastModel(),
    reachable: ping.ok,
    latencyMs: ping.ms,
    status: ping.status,
  });
}
