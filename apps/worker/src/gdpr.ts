import { type Database, schema } from '@storyme/database';
import { eq } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { StorageUploader } from './storage.js';

export interface GdprDeps {
  runAsAdmin: <T>(fn: (tx: Database) => Promise<T>) => Promise<T>;
  uploader: StorageUploader;
  logger: Logger;
}

/**
 * GDPR/CCPA data-subject operations run asynchronously off the queue:
 *  - erasure: purge the user's media from storage and hard-delete their rows.
 *  - export: assemble a machine-readable bundle of the user's data to storage.
 */
export class GdprProcessor {
  constructor(private readonly deps: GdprDeps) {}

  /** Right to erasure. Assumes the account was already soft-deleted by the API. */
  async deleteAccount(userId: string): Promise<void> {
    const { runAsAdmin, uploader, logger } = this.deps;
    const removed = await uploader.removePrefix(`users/${userId}/`);
    // Delete media for the user's comics too.
    const comics = await runAsAdmin((tx) =>
      tx.select({ id: schema.comics.id }).from(schema.comics).where(eq(schema.comics.userId, userId)),
    );
    for (const c of comics) await uploader.removePrefix(`comics/${c.id}/`);

    // Hard delete the user; FK cascades remove owned rows (comics, characters, etc.).
    await runAsAdmin((tx) => tx.delete(schema.users).where(eq(schema.users.id, userId)));
    logger.info({ userId, mediaRemoved: removed, comics: comics.length }, 'account erased (GDPR)');
  }

  /** Right to data portability. Produces a JSON bundle to storage. */
  async exportData(userId: string): Promise<string> {
    const { runAsAdmin, uploader, logger } = this.deps;
    const bundle = await runAsAdmin(async (tx) => {
      const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      const characters = await tx
        .select()
        .from(schema.characters)
        .where(eq(schema.characters.userId, userId));
      const comics = await tx.select().from(schema.comics).where(eq(schema.comics.userId, userId));
      const ledger = await tx
        .select()
        .from(schema.creditLedger)
        .where(eq(schema.creditLedger.userId, userId));
      return { exportedAt: new Date().toISOString(), user, characters, comics, creditLedger: ledger };
    });

    const key = `exports/${userId}/${Date.now()}.json`;
    await uploader.put(key, new TextEncoder().encode(JSON.stringify(bundle, null, 2)), 'application/json');
    await runAsAdmin((tx) =>
      tx.insert(schema.notifications).values({ userId, type: 'export_ready', data: { key } }),
    );
    logger.info({ userId, key }, 'data export ready (GDPR)');
    return key;
  }
}
