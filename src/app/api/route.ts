import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supabaseConfiguredOnServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitors and the Render healthCheckPath.
 * Always answers 2xx while the Node server is alive (so a Postgres hiccup
 * does not flap the deploy); the `db` field reports connectivity so
 * external monitoring can alert on `db:false`.
 */
export async function GET() {
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    /* DB unreachable — server itself is still healthy */
  }
  // Has the per-chart / Supabase migration been applied? (User.authId exists)
  let migrated = false;
  if (dbOk) {
    try {
      await db.$queryRaw`SELECT "authId" FROM "User" LIMIT 1`;
      migrated = true;
    } catch {
      /* column missing → run: npx prisma migrate deploy */
    }
  }
  return NextResponse.json({
    ok: true,
    service: "astrovia",
    db: dbOk,
    // Setup self-check: booleans only, never secrets.
    migrated,
    supabaseKeys: supabaseConfiguredOnServer,
    sessionSecret: Boolean(process.env.SESSION_SECRET),
    ts: new Date().toISOString(),
  });
}
