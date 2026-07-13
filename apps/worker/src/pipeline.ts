import { type AiService, ContentBlockedError } from '@storyme/ai';
import { type Database, schema } from '@storyme/database';
import { ComicStatus, CREDIT_COST, JobStatus, JobType } from '@storyme/shared-types';
import { and, eq } from 'drizzle-orm';
import type { Logger } from 'pino';
import { StorageUploader } from './storage.js';
import { type Notifier, NoopNotifier } from './notifications.js';
import { type ReelFrame, ReelAssembler } from './reel.js';

export interface PipelineDeps {
  db: Database;
  runAsAdmin: <T>(fn: (tx: Database) => Promise<T>) => Promise<T>;
  ai: AiService;
  uploader: StorageUploader;
  logger: Logger;
  /** Optional; defaults to a no-op notifier (used in tests/local). */
  notifier?: Notifier;
  /** Optional reel assembler; defaults to a real ffmpeg-backed one. */
  reelAssembler?: ReelAssembler;
}

/**
 * The comic-generation pipeline: moderation → script → per-panel character-consistent
 * images → assembly. Idempotent and safe to retry; on unrecoverable failure it marks
 * the comic failed and refunds the reserved credits (compensating ledger entry).
 */
export class ComicPipeline {
  private readonly notifier: Notifier;
  private readonly reelAssembler: ReelAssembler;
  constructor(private readonly deps: PipelineDeps) {
    this.notifier = deps.notifier ?? new NoopNotifier();
    this.reelAssembler = deps.reelAssembler ?? new ReelAssembler(deps.logger);
  }

  async generateComic(comicId: string): Promise<void> {
    const { runAsAdmin, ai, uploader, logger } = this.deps;

    const comic = await runAsAdmin(async (tx) => {
      const [row] = await tx.select().from(schema.comics).where(eq(schema.comics.id, comicId)).limit(1);
      return row ?? null;
    });
    if (!comic) {
      logger.warn({ comicId }, 'comic not found; skipping');
      return;
    }
    if (comic.status === ComicStatus.Complete) {
      logger.info({ comicId }, 'comic already complete; skipping (idempotent)');
      return;
    }

    try {
      await this.setStatus(comicId, ComicStatus.Processing, 5);

      // 1. Moderate the user's prompt.
      await ai.moderate({ kind: 'text', text: comic.prompt });

      // 2. Resolve character identity reference.
      const identityRef = await runAsAdmin(async (tx) => {
        if (!comic.characterId) return {};
        const [c] = await tx
          .select({ ref: schema.characters.identityRef, name: schema.characters.name })
          .from(schema.characters)
          .where(eq(schema.characters.id, comic.characterId))
          .limit(1);
        return { ref: (c?.ref as Record<string, unknown>) ?? {}, name: c?.name ?? 'Hero' };
      });
      const characterName = (identityRef.name as string) ?? comic.title ?? 'Hero';

      // 3. Generate the script.
      const script = await ai.generateScript({
        prompt: comic.prompt,
        style: comic.style as never,
        characterName,
        panelCount: comic.panelCount,
      });

      // 4. Persist title + fresh panel rows.
      await runAsAdmin(async (tx) => {
        await tx.update(schema.comics).set({ title: comic.title ?? script.title }).where(eq(schema.comics.id, comicId));
        await tx.delete(schema.panels).where(eq(schema.panels.comicId, comicId));
        await tx.insert(schema.panels).values(
          script.panels.map((p, i) => ({
            comicId,
            index: i,
            scene: p.scene,
            dialogue: p.dialogue,
            status: 'pending' as const,
          })),
        );
      });

      // 5. Render each panel image, upload it, and record progress.
      const isReel = comic.format === 'reel';
      const frames: ReelFrame[] = [];
      let coverKey: string | null = null;
      for (let i = 0; i < script.panels.length; i++) {
        const panel = script.panels[i]!;
        const image = await ai.generatePanel({
          scene: panel.scene,
          style: comic.style as never,
          characterName,
          identityRef: (identityRef.ref as Record<string, unknown>) ?? {},
          panelIndex: i,
        });
        const ext = image.contentType.split('/')[1] ?? 'png';
        const key = `comics/${comicId}/panel-${i}.${ext}`;
        await uploader.put(key, image.data, image.contentType);
        if (i === 0) coverKey = key;
        if (isReel) frames.push({ data: image.data, contentType: image.contentType });

        await runAsAdmin((tx) =>
          tx
            .update(schema.panels)
            .set({ imageKey: key, status: 'ready' })
            .where(and(eq(schema.panels.comicId, comicId), eq(schema.panels.index, i))),
        );
        await this.setProgress(comicId, Math.round(10 + ((i + 1) / script.panels.length) * 80));
      }

      // 5b. For reels, assemble a vertical MP4 from the frames and upload it.
      let videoKey: string | null = null;
      if (isReel) {
        await this.setProgress(comicId, 92);
        const mp4 = await this.reelAssembler.assemble(frames);
        videoKey = `comics/${comicId}/reel.mp4`;
        await uploader.put(videoKey, mp4, 'video/mp4');
      }

      // 6. Finalize.
      await runAsAdmin(async (tx) => {
        await tx
          .update(schema.comics)
          .set({ status: ComicStatus.Complete, coverKey, videoKey })
          .where(eq(schema.comics.id, comicId));
        await tx
          .insert(schema.comicStats)
          .values({ comicId })
          .onConflictDoNothing({ target: schema.comicStats.comicId });
        await tx
          .update(schema.jobs)
          .set({ status: JobStatus.Completed, progress: 100 })
          .where(and(eq(schema.jobs.comicId, comicId), eq(schema.jobs.type, JobType.GenerateComic)));
        await tx
          .insert(schema.notifications)
          .values({ userId: comic.userId, type: 'comic_ready', data: { comicId } });
      });
      await this.notifier.notify({
        userId: comic.userId,
        type: 'comic_ready',
        title: 'Your comic is ready! 🎉',
        body: comic.title ?? 'Tap to read your new comic.',
        data: { comicId },
      });
      logger.info({ comicId, panels: script.panels.length }, 'comic generation complete');
    } catch (err) {
      await this.handleFailure(comic.id, comic.userId, comic.panelCount, err);
      throw err;
    }
  }

  private async handleFailure(comicId: string, userId: string, panelCount: number, err: unknown): Promise<void> {
    const blocked = err instanceof ContentBlockedError;
    const status = blocked ? ComicStatus.Moderated : ComicStatus.Failed;
    const cost = CREDIT_COST.PER_COMIC_BASE + panelCount * CREDIT_COST.PER_PANEL;

    await this.deps.runAsAdmin(async (tx) => {
      await tx.update(schema.comics).set({ status }).where(eq(schema.comics.id, comicId));
      await tx
        .update(schema.jobs)
        .set({ status: JobStatus.Failed, error: { message: String(err) } })
        .where(and(eq(schema.jobs.comicId, comicId), eq(schema.jobs.type, JobType.GenerateComic)));
      // Refund reserved credits (idempotent via unique reason+ref_id).
      await tx
        .insert(schema.creditLedger)
        .values({ userId, delta: cost, reason: 'comic_generation_refund', refId: comicId })
        .onConflictDoNothing();
      await tx
        .insert(schema.notifications)
        .values({ userId, type: blocked ? 'comic_blocked' : 'comic_failed', data: { comicId } });
    });
    this.deps.logger.error({ comicId, err: String(err) }, 'comic generation failed; credits refunded');
  }

  private setStatus(comicId: string, status: ComicStatus, progress: number): Promise<unknown> {
    return this.deps.runAsAdmin(async (tx) => {
      await tx.update(schema.comics).set({ status }).where(eq(schema.comics.id, comicId));
      await tx
        .update(schema.jobs)
        .set({ status: JobStatus.Active, progress })
        .where(and(eq(schema.jobs.comicId, comicId), eq(schema.jobs.type, JobType.GenerateComic)));
    });
  }

  private setProgress(comicId: string, progress: number): Promise<unknown> {
    return this.deps.runAsAdmin((tx) =>
      tx
        .update(schema.jobs)
        .set({ progress })
        .where(and(eq(schema.jobs.comicId, comicId), eq(schema.jobs.type, JobType.GenerateComic))),
    );
  }
}
