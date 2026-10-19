/**
 * Dev server launcher — boots the complete local stack in one process tree:
 *   1. local embedded Postgres (unless a real DATABASE_URL is already set)
 *   2. `next dev -p 3000` (output teed to dev.log, same as before)
 *
 * The sandbox exports a legacy DATABASE_URL (SQLite) globally which would
 * override .env — we pin it to the local Postgres in that case. In normal
 * environments a real DATABASE_URL passes straight through.
 */
import { startPostgres, PG_URL } from './dev-postgres';

const url = process.env.DATABASE_URL ?? '';
if (!url || url.startsWith('file:')) {
  const pg = await startPostgres();
  process.env.DATABASE_URL = PG_URL;
  // Best-effort: stop the cluster when the dev server exits.
  const stopPg = () => pg.stop().catch(() => {});
  process.on('SIGINT', () => {
    stopPg();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    stopPg();
    process.exit(0);
  });
}

const child = Bun.spawn(['sh', '-c', 'exec bunx next dev -p 3000 2>&1 | tee dev.log'], {
  env: process.env,
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
});
const relay = (sig: NodeJS.Signals) => () => child.kill(sig);
process.on('SIGINT', relay('SIGINT'));
process.on('SIGTERM', relay('SIGTERM'));
await child.exited;
