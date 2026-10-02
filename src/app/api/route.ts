import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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
  return NextResponse.json({
    ok: true,
    service: "astrovia",
    db: dbOk,
    ts: new Date().toISOString(),
  });
}
