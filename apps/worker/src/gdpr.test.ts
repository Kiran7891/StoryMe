import { closeDb, getDb, schema, withUserContext } from '@storyme/database';
import { eq } from 'drizzle-orm';
import pino from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { GdprProcessor } from './gdpr.js';
import type { StorageUploader } from './storage.js';

const hasDb = !!process.env.DATABASE_URL;

class InMemoryUploader implements StorageUploader {
  objects = new Set<string>();
  async put(key: string, _data: Uint8Array, _contentType: string): Promise<void> {
    this.objects.add(key);
  }
  async removePrefix(prefix: string): Promise<number> {
    let n = 0;
    for (const k of [...this.objects]) {
      if (k.startsWith(prefix)) {
        this.objects.delete(k);
        n++;
      }
    }
    return n;
  }
}

describe.skipIf(!hasDb)('GdprProcessor (integration)', () => {
  const db = hasDb ? getDb() : (undefined as never);
  const runAsAdmin = <T>(fn: (tx: typeof db) => Promise<T>) =>
    withUserContext(db, null, fn, { isAdmin: true });
  const logger = pino({ level: 'silent' });

  afterAll(async () => {
    await closeDb();
  });

  it('exports a user data bundle and records a notification', async () => {
    const uploader = new InMemoryUploader();
    const gdpr = new GdprProcessor({ runAsAdmin, uploader, logger });
    const [user] = await runAsAdmin((tx) =>
      tx.insert(schema.users).values({ email: `exp-${Math.random()}@t.co`, authSub: `s-${Math.random()}` }).returning(),
    );
    const key = await gdpr.exportData(user!.id);
    expect(key).toMatch(/^exports\//);
    expect(uploader.objects.has(key)).toBe(true);
    const notes = await runAsAdmin((tx) =>
      tx.select().from(schema.notifications).where(eq(schema.notifications.userId, user!.id)),
    );
    expect(notes.some((n) => n.type === 'export_ready')).toBe(true);
  });

  it('erases a user and their media', async () => {
    const uploader = new InMemoryUploader();
    const gdpr = new GdprProcessor({ runAsAdmin, uploader, logger });
    const [user] = await runAsAdmin((tx) =>
      tx.insert(schema.users).values({ email: `del-${Math.random()}@t.co`, authSub: `s-${Math.random()}` }).returning(),
    );
    await uploader.put(`users/${user!.id}/uploads/a.jpg`, new Uint8Array(), 'image/jpeg');

    await gdpr.deleteAccount(user!.id);

    const remaining = await runAsAdmin((tx) =>
      tx.select().from(schema.users).where(eq(schema.users.id, user!.id)),
    );
    expect(remaining).toHaveLength(0);
    expect(uploader.objects.size).toBe(0);
  });
});
