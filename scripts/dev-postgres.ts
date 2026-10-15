/**
 * Local development Postgres for Astrovia (reusable module + CLI).
 *
 * Production uses Supabase Postgres (see DATABASE_URL in .env.example).
 * For local dev we boot a real Postgres cluster from the `embedded-postgres`
 * binaries — same provider as production, so the `prisma migrate` history
 * is exercised end-to-end.
 *
 * Data dir: db/pgdata (persistent — safe to re-run).
 * CLI usage: bun scripts/dev-postgres.ts   (keeps running until killed)
 */
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';

/* The bundled Postgres binaries ship their own ICU/OpenSSL in
   node_modules/@embedded-postgres/<platform>/native/lib — point the dynamic
   linker there before spawning (idempotent, works from any cwd). */
const PG_NATIVE_LIB = path.join(
  process.cwd(),
  'node_modules',
  '@embedded-postgres',
  'linux-x64',
  'native',
  'lib',
);
process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
  ? `${PG_NATIVE_LIB}:${process.env.LD_LIBRARY_PATH}`
  : PG_NATIVE_LIB;

export const PG_PORT = Number(process.env.PG_PORT ?? 5432);
export const PG_DATA_DIR = path.join(process.cwd(), 'db', 'pgdata');
export const PG_URL = `postgresql://vedastro:vedastro@localhost:${PG_PORT}/vedastro`;

/** True when something accepts TCP connections on the cluster port. */
async function portServing(): Promise<boolean> {
  try {
    await Bun.connect({
      hostname: '127.0.0.1',
      port: PG_PORT,
      socket: { data: () => {} },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Boots the local cluster (initialising on first run) and returns the handle.
 * Resolves immediately if the port is already serving.
 */
export async function startPostgres(): Promise<EmbeddedPostgres> {
  const pg = new EmbeddedPostgres({
    databaseDir: PG_DATA_DIR,
    user: 'vedastro',
    password: 'vedastro',
    port: PG_PORT,
    persistent: true,
    createPostgresUser: true,
  });

  if (await portServing()) {
    console.log(`[dev-postgres] already serving on :${PG_PORT}`);
    return pg;
  }

  if (!fs.existsSync(path.join(PG_DATA_DIR, 'PG_VERSION'))) {
    await pg.initialise();
    console.log(`[dev-postgres] initialised new cluster at ${PG_DATA_DIR}`);
  }
  try {
    await pg.start();
  } catch (err) {
    // Tolerate a lost race: another process already owns the data directory.
    if (await portServing()) {
      console.log(`[dev-postgres] cluster already running on :${PG_PORT}`);
      return pg;
    }
    throw err;
  }
  try {
    await pg.createDatabase('vedastro');
    console.log('[dev-postgres] created database "vedastro"');
  } catch {
    /* already exists */
  }
  console.log(`[dev-postgres] ready — ${PG_URL}`);
  return pg;
}

/* CLI entry */
if (import.meta.main) {
  startPostgres().catch((err) => {
    console.error('[dev-postgres] failed:', err);
    process.exit(1);
  });
  // Stay alive so the cluster keeps serving.
  setInterval(() => {}, 1 << 30);
}
