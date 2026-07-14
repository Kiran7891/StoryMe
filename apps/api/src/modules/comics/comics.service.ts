import { Injectable } from '@nestjs/common';
import { schema } from '@storyme/database';
import {
  COMIC_LIMITS,
  CREDIT_COST,
  ComicStatus,
  JobStatus,
  JobType,
  PLAN_ENTITLEMENTS,
  type SubscriptionPlan,
} from '@storyme/shared-types';
import type { CreateComicInput, ShareComicInput } from '@storyme/validation';
import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { AppError } from '../../common/app-error.js';
import { DatabaseService } from '../../infra/database.module.js';
import { QueueService } from '../../infra/queue.module.js';
import { CreditsService } from '../credits/credits.service.js';

@Injectable()
export class ComicsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly credits: CreditsService,
    private readonly queue: QueueService,
  ) {}

  async list(userId: string, limit: number, cursor?: string) {
    return this.database.asUser(userId, (tx) =>
      tx
        .select()
        .from(schema.comics)
        .where(
          and(
            eq(schema.comics.userId, userId),
            isNull(schema.comics.deletedAt),
            cursor ? lt(schema.comics.createdAt, new Date(cursor)) : undefined,
          ),
        )
        .orderBy(desc(schema.comics.createdAt))
        .limit(limit),
    );
  }

  async get(userId: string, id: string) {
    return this.database.asUser(userId, async (tx) => {
      const [comic] = await tx
        .select()
        .from(schema.comics)
        .where(and(eq(schema.comics.id, id), isNull(schema.comics.deletedAt)))
        .limit(1);
      if (!comic) throw AppError.notFound('Comic');
      const panels = await tx
        .select()
        .from(schema.panels)
        .where(eq(schema.panels.comicId, id))
        .orderBy(schema.panels.index);
      const [stats] = await tx
        .select()
        .from(schema.comicStats)
        .where(eq(schema.comicStats.comicId, id))
        .limit(1);
      return { ...comic, panels, stats: stats ?? null };
    });
  }

  async status(userId: string, id: string) {
    return this.database.asUser(userId, async (tx) => {
      const [comic] = await tx
        .select({ id: schema.comics.id, status: schema.comics.status })
        .from(schema.comics)
        .where(eq(schema.comics.id, id))
        .limit(1);
      if (!comic) throw AppError.notFound('Comic');
      const [job] = await tx
        .select({ progress: schema.jobs.progress, status: schema.jobs.status, error: schema.jobs.error })
        .from(schema.jobs)
        .where(and(eq(schema.jobs.comicId, id), eq(schema.jobs.type, JobType.GenerateComic)))
        .orderBy(desc(schema.jobs.createdAt))
        .limit(1);
      return { id: comic.id, status: comic.status, progress: job?.progress ?? 0, jobStatus: job?.status ?? null };
    });
  }

  /**
   * Create a comic: enforce plan panel limits, reserve credits, persist the comic +
   * generation job, and enqueue it. The whole operation is one atomic transaction;
   * the credit reservation and job are keyed by the comic id for idempotency.
   */
  async create(userId: string, input: CreateComicInput) {
    const panelCount = input.panelCount ?? COMIC_LIMITS.DEFAULT_PANELS;

    const comic = await this.database.asAdmin(async (tx) => {
      // Entitlement check: plan panel cap
      const [billing] = await tx
        .select({ plan: schema.billingAccounts.plan })
        .from(schema.billingAccounts)
        .where(eq(schema.billingAccounts.userId, userId))
        .limit(1);
      const plan = (billing?.plan ?? 'free') as SubscriptionPlan;
      if (panelCount > PLAN_ENTITLEMENTS[plan].maxPanels) {
        throw new AppError('quota_exceeded', `Your plan allows up to ${PLAN_ENTITLEMENTS[plan].maxPanels} panels`);
      }

      // The referenced character must belong to the requesting user.
      const [character] = await tx
        .select({ id: schema.characters.id })
        .from(schema.characters)
        .where(
          and(
            eq(schema.characters.id, input.characterId),
            eq(schema.characters.userId, userId),
            isNull(schema.characters.deletedAt),
          ),
        )
        .limit(1);
      if (!character) throw AppError.notFound('Character');

      const [comicRow] = await tx
        .insert(schema.comics)
        .values({
          userId,
          characterId: input.characterId,
          title: input.title ?? null,
          prompt: input.prompt,
          style: input.style,
          format: input.format ?? 'book',
          panelCount,
          status: ComicStatus.Queued,
        })
        .returning();
      if (!comicRow) throw new AppError('internal_error', 'Failed to create comic');

      // Reserve credits (idempotent by comic id).
      const cost = CREDIT_COST.PER_COMIC_BASE + panelCount * CREDIT_COST.PER_PANEL;
      await this.credits.reserve(tx, userId, cost, 'comic_generation', comicRow.id);

      await tx.insert(schema.jobs).values({
        comicId: comicRow.id,
        userId,
        type: JobType.GenerateComic,
        status: JobStatus.Queued,
        idempotencyKey: `generate:${comicRow.id}`,
      });
      return comicRow;
    });

    await this.queue.enqueue(
      JobType.GenerateComic,
      { comicId: comic.id, userId },
      { jobId: `generate-${comic.id}` }, // BullMQ job ids cannot contain ':'
    );
    return comic;
  }

  async setShare(userId: string, id: string, input: ShareComicInput) {
    return this.database.asUser(userId, async (tx) => {
      const [comic] = await tx
        .select()
        .from(schema.comics)
        .where(and(eq(schema.comics.id, id), eq(schema.comics.userId, userId)))
        .limit(1);
      if (!comic) throw AppError.notFound('Comic');
      if (input.isPublic && comic.status !== ComicStatus.Complete) {
        throw AppError.conflict('Only completed comics can be shared');
      }
      const shareSlug = comic.shareSlug ?? nanoid(10);
      const [updated] = await tx
        .update(schema.comics)
        .set({
          isPublic: input.isPublic,
          shareSlug,
          publishedAt: input.isPublic ? (comic.publishedAt ?? new Date()) : comic.publishedAt,
        })
        .where(eq(schema.comics.id, id))
        .returning({ id: schema.comics.id, isPublic: schema.comics.isPublic, shareSlug: schema.comics.shareSlug });
      return updated;
    });
  }
}
