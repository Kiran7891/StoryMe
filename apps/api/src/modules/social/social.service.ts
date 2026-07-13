import { Injectable } from '@nestjs/common';
import { schema } from '@storyme/database';
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { AppError } from '../../common/app-error.js';
import { DatabaseService } from '../../infra/database.module.js';

type FeedKind = 'following' | 'discover' | 'reels';

@Injectable()
export class SocialService {
  constructor(private readonly database: DatabaseService) {}

  /** Following / discover / reels feeds. Keyset paginated on published_at. */
  async feed(userId: string, kind: FeedKind, limit: number, cursor?: string) {
    return this.database.asUser(userId, async (tx) => {
      const publicFilter = and(
        eq(schema.comics.isPublic, true),
        eq(schema.comics.status, 'complete'),
        eq(schema.comics.moderation, 'approved'),
        isNull(schema.comics.deletedAt),
        cursor ? lt(schema.comics.publishedAt, new Date(cursor)) : undefined,
        kind === 'reels' ? eq(schema.comics.format, 'reel') : undefined,
      );

      const base = tx
        .select({
          id: schema.comics.id,
          userId: schema.comics.userId,
          title: schema.comics.title,
          style: schema.comics.style,
          format: schema.comics.format,
          coverKey: schema.comics.coverKey,
          videoKey: schema.comics.videoKey,
          shareSlug: schema.comics.shareSlug,
          publishedAt: schema.comics.publishedAt,
          likeCount: sql<number>`COALESCE(${schema.comicStats.likeCount}, 0)`,
          commentCount: sql<number>`COALESCE(${schema.comicStats.commentCount}, 0)`,
        })
        .from(schema.comics)
        .leftJoin(schema.comicStats, eq(schema.comicStats.comicId, schema.comics.id));

      if (kind === 'following') {
        return base
          .innerJoin(
            schema.follows,
            and(
              eq(schema.follows.followeeId, schema.comics.userId),
              eq(schema.follows.followerId, userId),
            ),
          )
          .where(publicFilter)
          .orderBy(desc(schema.comics.publishedAt))
          .limit(limit);
      }
      return base.where(publicFilter).orderBy(desc(schema.comics.publishedAt)).limit(limit);
    });
  }

  async like(userId: string, comicId: string) {
    await this.database.asUser(userId, (tx) =>
      tx
        .insert(schema.likes)
        .values({ userId, comicId })
        .onConflictDoNothing({ target: [schema.likes.userId, schema.likes.comicId] }),
    );
    await this.notifyOwner(userId, comicId, 'like');
    return { status: 'liked' as const };
  }

  async unlike(userId: string, comicId: string) {
    await this.database.asUser(userId, (tx) =>
      tx
        .delete(schema.likes)
        .where(and(eq(schema.likes.userId, userId), eq(schema.likes.comicId, comicId))),
    );
    return { status: 'unliked' as const };
  }

  async listComments(userId: string, comicId: string, limit: number) {
    return this.database.asUser(userId, (tx) =>
      tx
        .select({
          id: schema.comments.id,
          userId: schema.comments.userId,
          body: schema.comments.body,
          parentId: schema.comments.parentId,
          createdAt: schema.comments.createdAt,
        })
        .from(schema.comments)
        .where(and(eq(schema.comments.comicId, comicId), isNull(schema.comments.deletedAt)))
        .orderBy(desc(schema.comments.createdAt))
        .limit(limit),
    );
  }

  async addComment(userId: string, comicId: string, body: string, parentId?: string) {
    const comment = await this.database.asUser(userId, async (tx) => {
      const [row] = await tx
        .insert(schema.comments)
        .values({ userId, comicId, body, parentId: parentId ?? null })
        .returning();
      if (!row) throw new AppError('internal_error', 'Failed to add comment');
      return row;
    });
    await this.notifyOwner(userId, comicId, 'comment');
    return comment;
  }

  async deleteComment(userId: string, commentId: string) {
    await this.database.asUser(userId, (tx) =>
      tx
        .update(schema.comments)
        .set({ deletedAt: new Date() })
        .where(and(eq(schema.comments.id, commentId), eq(schema.comments.userId, userId))),
    );
    return { status: 'deleted' as const };
  }

  async repost(userId: string, comicId: string, caption?: string) {
    await this.database.asUser(userId, (tx) =>
      tx
        .insert(schema.reposts)
        .values({ userId, comicId, caption: caption ?? null })
        .onConflictDoNothing({ target: [schema.reposts.userId, schema.reposts.comicId] }),
    );
    await this.notifyOwner(userId, comicId, 'repost');
    return { status: 'reposted' as const };
  }

  async follow(userId: string, targetId: string) {
    if (userId === targetId) throw AppError.conflict('You cannot follow yourself');
    await this.database.asUser(userId, (tx) =>
      tx
        .insert(schema.follows)
        .values({ followerId: userId, followeeId: targetId })
        .onConflictDoNothing(),
    );
    await this.database.asAdmin((tx) =>
      tx
        .insert(schema.notifications)
        .values({ userId: targetId, type: 'follow', data: { actorId: userId } }),
    );
    return { status: 'following' as const };
  }

  async unfollow(userId: string, targetId: string) {
    await this.database.asUser(userId, (tx) =>
      tx
        .delete(schema.follows)
        .where(and(eq(schema.follows.followerId, userId), eq(schema.follows.followeeId, targetId))),
    );
    return { status: 'unfollowed' as const };
  }

  async recordView(comicId: string) {
    await this.database.asAdmin((tx) =>
      tx
        .insert(schema.comicStats)
        .values({ comicId, viewCount: 1 })
        .onConflictDoUpdate({
          target: schema.comicStats.comicId,
          set: { viewCount: sql`${schema.comicStats.viewCount} + 1` },
        }),
    );
    return { status: 'recorded' as const };
  }

  /** Best-effort notification to the content owner (skips self-actions). */
  private async notifyOwner(actorId: string, comicId: string, type: string): Promise<void> {
    await this.database.asAdmin(async (tx) => {
      const [comic] = await tx
        .select({ ownerId: schema.comics.userId })
        .from(schema.comics)
        .where(eq(schema.comics.id, comicId))
        .limit(1);
      if (!comic || comic.ownerId === actorId) return;
      await tx
        .insert(schema.notifications)
        .values({ userId: comic.ownerId, type, data: { actorId, comicId } });
    });
  }
}
