import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

let sqlClient: ReturnType<typeof postgres> | null = null;
let dbInstance: Database | null = null;

/**
 * Create (once) a Drizzle client backed by a pooled postgres-js connection.
 * Use DATABASE_POOL_URL (PgBouncer transaction pooler) in serverless/worker
 * contexts; fall back to DATABASE_URL.
 */
export function getDb(connectionString?: string): Database {
  if (dbInstance) return dbInstance;
  const url = connectionString ?? process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL (or DATABASE_POOL_URL) is required');
  sqlClient = postgres(url, { max: 10, prepare: false });
  dbInstance = drizzle(sqlClient, { schema });
  return dbInstance;
}

/**
 * Run `fn` inside a transaction with the RLS GUCs set for the given user, so
 * row-level security policies apply. Pass { isAdmin: true } for privileged ops.
 */
export async function withUserContext<T>(
  db: Database,
  userId: string | null,
  fn: (tx: Database) => Promise<T>,
  opts: { isAdmin?: boolean } = {},
): Promise<T> {
  return db.transaction(async (tx) => {
    // set_config(name, value, is_local=true) → GUC scoped to this transaction
    await tx.execute(
      sql`select set_config('app.current_user_id', ${userId ?? ''}, true),
                 set_config('app.is_admin', ${opts.isAdmin ? 'true' : 'false'}, true)`,
    );
    return fn(tx as Database);
  });
}

export async function closeDb(): Promise<void> {
  if (sqlClient) await sqlClient.end();
  sqlClient = null;
  dbInstance = null;
}
