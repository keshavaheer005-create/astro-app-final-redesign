/**
 * `bun run db:push` — boots the embedded dev Postgres when it is not already
 * serving, then pushes the Prisma schema.
 *
 * The sandbox dev supervisor runs `bun run db:push` BEFORE `bun run dev`, so
 * this script must bring the cluster up by itself. The cluster keeps serving
 * after this process exits (same as start-dev.ts), so `start-dev.ts` will
 * detect it on the port and skip its own boot.
 */
import { startPostgres, PG_URL } from './dev-postgres';

await startPostgres();
process.env.DATABASE_URL = PG_URL;

const proc = Bun.spawn(['bunx', 'prisma', 'db', 'push', '--accept-data-loss'], {
  env: process.env,
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
});
await proc.exited;
process.exit(proc.exitCode ?? 0);
