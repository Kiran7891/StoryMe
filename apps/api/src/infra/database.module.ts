import { Global, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { closeDb, type Database, getDb, withUserContext } from '@storyme/database';

/**
 * Wraps the shared Drizzle client. `asUser` runs a callback in a transaction with
 * the RLS GUCs set, so row-level security policies apply to every query inside.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: Database = getDb();

  /** Run queries scoped to a user (RLS enforced). */
  asUser<T>(userId: string, fn: (tx: Database) => Promise<T>): Promise<T> {
    return withUserContext(this.db, userId, fn);
  }

  /** Run queries with admin privileges (RLS bypass via app.is_admin GUC). */
  asAdmin<T>(fn: (tx: Database) => Promise<T>): Promise<T> {
    return withUserContext(this.db, null, fn, { isAdmin: true });
  }

  /** Run queries as an anonymous visitor (RLS: only public rows are visible). */
  asPublic<T>(fn: (tx: Database) => Promise<T>): Promise<T> {
    return withUserContext(this.db, null, fn);
  }

  async onModuleDestroy(): Promise<void> {
    await closeDb();
  }
}

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
