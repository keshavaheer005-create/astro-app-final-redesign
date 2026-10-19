import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supabaseConfiguredOnServer } from "@/lib/supabase/server";
import { inspectSessionSecret } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitors and the Render healthCheckPath.
 *
 * Status codes:
 *   • 200 — the server is alive. A Postgres hiccup does NOT fail the check
 *           (that would flap deploys); read the `db` field instead.
 *   • 503 — the deployment is misconfigured (`SESSION_SECRET` missing/weak).
 *           That is not transient, the app cannot sign anyone in, and a deploy
 *           that would serve a broken app should be marked unhealthy so Render
 *           keeps the previous version live.
 */
export async function GET() {
  const secret = inspectSessionSecret();
  const sessionSecretOk = !secret.fatal;

  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    /* DB unreachable - the server itself is still healthy */
  }

  // Has the per-chart / Supabase migration been applied? (User.authId exists)
  let migrated = false;
  if (dbOk) {
    try {
      await db.$queryRaw`SELECT "authId" FROM "User" LIMIT 1`;
      migrated = true;
    } catch {
      /* column missing -> run: bunx prisma migrate deploy */
    }
  }

  return NextResponse.json(
    {
      ok: sessionSecretOk,
      service: "astrovia",
      db: dbOk,
      // Setup self-check: booleans (and rule descriptions) only, never secrets.
      migrated,
      supabaseKeys: supabaseConfiguredOnServer,
      sessionSecret: Boolean(process.env.SESSION_SECRET),
      sessionSecretOk,
      // Always reported when there is something to say, including the
      // "escape hatch is active" case (200, but not production-grade).
      ...(secret.problems.length ? { sessionSecretProblems: secret.problems } : {}),
      ts: new Date().toISOString(),
    },
    {
      status: sessionSecretOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
