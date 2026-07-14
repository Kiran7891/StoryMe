import { createAiService } from '@storyme/ai';
import { closeDb, getDb, schema, withUserContext } from '@storyme/database';
import { ComicStatus } from '@storyme/shared-types';
import { eq, sql } from 'drizzle-orm';
import pino from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { ComicPipeline } from './pipeline.js';
import type { StorageUploader } from './storage.js';

// Integration test — only runs when a Postgres DATABASE_URL is provided.
const hasDb = !!process.env.DATABASE_URL;

class InMemoryUploader implements StorageUploader {
  puts: string[] = [];
  async put(key: string): Promise<void> {
    this.puts.push(key);
  }
  async removePrefix(prefix: string): Promise<number> {
    const before = this.puts.length;
    this.puts = this.puts.filter((k) => !k.startsWith(prefix));
    return before - this.puts.length;
  }
}

describe.skipIf(!hasDb)('ComicPipeline (integration)', () => {
  // Guarded: getDb() is only constructed when a DATABASE_URL is present so the suite
  // is safely skippable in unit-only CI runs.
  const db = hasDb ? getDb() : (undefined as never);
  const runAsAdmin = <T>(fn: (tx: typeof db) => Promise<T>) =>
    withUserContext(db, null, fn, { isAdmin: true });
  const logger = pino({ level: 'silent' });

  afterAll(async () => {
    await closeDb();
  });

  async function seedComic(prompt: string, format: 'book' | 'reel' = 'book') {
    return runAsAdmin(async (tx) => {
      const [user] = await tx
        .insert(schema.users)
        .values({ email: `pipe-${Date.now()}-${Math.random()}@t.co`, authSub: `s-${Math.random()}` })
        .returning();
      const [comic] = await tx
        .insert(schema.comics)
        .values({ userId: user!.id, prompt, style: 'manga', format, panelCount: 3, status: ComicStatus.Queued })
        .returning();
      await tx
        .insert(schema.jobs)
        .values({ comicId: comic!.id, userId: user!.id, type: 'generate_comic', status: 'queued' });
      // Reserve credits like the API would (grant 10, debit 4).
      await tx.insert(schema.creditLedger).values({ userId: user!.id, delta: 10, reason: 'seed', refId: comic!.id });
      await tx.insert(schema.creditLedger).values({ userId: user!.id, delta: -4, reason: 'comic_generation', refId: comic!.id });
      return { userId: user!.id, comicId: comic!.id };
    });
  }

  async function balance(userId: string): Promise<number> {
    const rows = await runAsAdmin((tx) =>
      tx
        .select({ b: sql<number>`COALESCE(SUM(${schema.creditLedger.delta}),0)` })
        .from(schema.creditLedger)
        .where(eq(schema.creditLedger.userId, userId)),
    );
    return Number(rows[0]?.b ?? 0);
  }

  it('generates a complete comic with panel images', async () => {
    const { comicId } = await seedComic('a friendly dragon bakes cookies');
    const uploader = new InMemoryUploader();
    const pipeline = new ComicPipeline({
      db,
      runAsAdmin,
      ai: createAiService({ AI_TEXT_PROVIDER: 'mock', AI_IMAGE_PROVIDER: 'mock' }),
      uploader,
      logger,
    });

    await pipeline.generateComic(comicId);

    const [comic] = await runAsAdmin((tx) =>
      tx.select().from(schema.comics).where(eq(schema.comics.id, comicId)).limit(1),
    );
    expect(comic!.status).toBe(ComicStatus.Complete);
    expect(comic!.coverKey).toBeTruthy();

    const panels = await runAsAdmin((tx) =>
      tx.select().from(schema.panels).where(eq(schema.panels.comicId, comicId)),
    );
    expect(panels).toHaveLength(3);
    expect(panels.every((p) => p.imageKey && p.status === 'ready')).toBe(true);
    expect(uploader.puts).toHaveLength(3);
  });

  it('assembles a reel MP4 for reel-format comics', async () => {
    const { comicId } = await seedComic('a puppy learns to surf', 'reel');
    const uploader = new InMemoryUploader();
    const pipeline = new ComicPipeline({
      db,
      runAsAdmin,
      ai: createAiService({ AI_TEXT_PROVIDER: 'mock', AI_IMAGE_PROVIDER: 'mock' }),
      uploader,
      logger,
    });

    await pipeline.generateComic(comicId);

    const [comic] = await runAsAdmin((tx) =>
      tx.select().from(schema.comics).where(eq(schema.comics.id, comicId)).limit(1),
    );
    expect(comic!.status).toBe(ComicStatus.Complete);
    expect(comic!.videoKey).toMatch(/reel\.mp4$/);
    expect(uploader.puts.some((k) => k.endsWith('reel.mp4'))).toBe(true);
  });

  it('blocks disallowed prompts and refunds credits', async () => {
    const { userId, comicId } = await seedComic('explicit content please');
    const before = await balance(userId); // 10 - 4 = 6
    const pipeline = new ComicPipeline({
      db,
      runAsAdmin,
      ai: createAiService({ AI_TEXT_PROVIDER: 'mock', AI_IMAGE_PROVIDER: 'mock' }),
      uploader: new InMemoryUploader(),
      logger,
    });

    await expect(pipeline.generateComic(comicId)).rejects.toThrow();

    const [comic] = await runAsAdmin((tx) =>
      tx.select().from(schema.comics).where(eq(schema.comics.id, comicId)).limit(1),
    );
    expect(comic!.status).toBe(ComicStatus.Moderated);
    expect(await balance(userId)).toBe(before + 4); // refunded
  });
});
