/**
 * One-off data migration: legacy SQLite (db/custom.db) → Postgres.
 * Preserves all rows and IDs exactly — no data-shape changes; only
 * SQLite's 0/1 booleans and ISO date strings are converted to native
 * Postgres types by Prisma.
 *
 * Usage (against a running local Postgres):
 *   DATABASE_URL=postgresql://vedastro:vedastro@localhost:5432/vedastro \
 *     bun scripts/migrate-sqlite-to-pg.ts
 */
import { PrismaClient } from '@prisma/client';
import { Database } from 'bun:sqlite';
import path from 'node:path';

const sqlitePath = process.env.SQLITE_PATH ?? path.join(process.cwd(), 'db', 'custom.db');

const sqlite = new Database(sqlitePath, { readonly: true });
const pg = new PrismaClient();

type Row = Record<string, unknown>;

const BOOLS: Record<string, string[]> = {
  User: ['isGuest'],
  BirthChart: ['isPrimary'],
  ReminderSettings: ['checkinReminder', 'weeklyReflectionN'],
};
const DATES: Record<string, string[]> = {
  User: ['createdAt', 'updatedAt'],
  BirthChart: ['createdAt'],
  ChatMessage: ['createdAt'],
  DailyCheckIn: ['createdAt'],
  WeeklyReflection: ['createdAt'],
  DecisionCheck: ['createdAt'],
};

/** FK-safe insertion order. */
const TABLES = [
  'User',
  'BirthChart',
  'ChatMessage',
  'DailyCheckIn',
  'WeeklyReflection',
  'DecisionCheck',
  'ReminderSettings',
] as const;

function convert(table: string, row: Row): Row {
  const out: Row = { ...row };
  for (const k of BOOLS[table] ?? []) out[k] = Number(out[k]) === 1;
  for (const k of DATES[table] ?? []) {
    const v = out[k];
    if (v == null) continue;
    // Prisma stores DateTime in SQLite as epoch-ms integers
    if (typeof v === 'number') out[k] = new Date(v);
    else if (typeof v === 'string' && /^\d+$/.test(v)) out[k] = new Date(Number(v));
    else out[k] = new Date(String(v));
    if (out[k] instanceof Date && isNaN((out[k] as Date).getTime())) {
      console.warn(`  ! ${table}.${k} unparseable (${String(v)}) — omitted, DB default applies`);
      delete out[k];
    }
  }
  return out;
}

async function main() {
  for (const table of TABLES) {
    const source = sqlite.query(`SELECT * FROM "${table}"`).all() as Row[];
    const key = table.charAt(0).toLowerCase() + table.slice(1);
    const model = (pg as unknown as Record<string, { createMany: (a: unknown) => Promise<{ count: number }>; count: () => Promise<number> }>)[key];
    const existing = await model.count();
    if (source.length === 0) {
      console.log(`${table}: source empty — skipped`);
      continue;
    }
    if (existing > 0) {
      console.log(`${table}: ${existing} rows already present — skipped (idempotent)`);
      continue;
    }
    const { count } = await model.createMany({ data: source.map((r) => convert(table, r)) });
    console.log(`${table}: copied ${count}/${source.length} rows`);
  }
  console.log('✅ data migration complete');
}

main()
  .catch((err) => {
    console.error('❌ data migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pg.$disconnect();
    sqlite.close();
  });
