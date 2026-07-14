import { Injectable } from '@nestjs/common';
import { schema } from '@storyme/database';
import { desc, eq, sql } from 'drizzle-orm';
import { AppError } from '../../common/app-error.js';
import { DatabaseService } from '../../infra/database.module.js';
import { CreditsService } from '../credits/credits.service.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly credits: CreditsService,
  ) {}

  listUsers(limit: number) {
    return this.database.asAdmin((tx) =>
      tx
        .select({
          id: schema.users.id,
          email: schema.users.email,
          handle: schema.users.handle,
          role: schema.users.role,
          createdAt: schema.users.createdAt,
          deletedAt: schema.users.deletedAt,
        })
        .from(schema.users)
        .orderBy(desc(schema.users.createdAt))
        .limit(limit),
    );
  }

  /** Open reports queue for moderation. */
  moderationQueue(limit: number) {
    return this.database.asAdmin((tx) =>
      tx
        .select()
        .from(schema.reports)
        .where(eq(schema.reports.status, 'open'))
        .orderBy(desc(schema.reports.createdAt))
        .limit(limit),
    );
  }

  async moderateComic(adminId: string, comicId: string, decision: 'approved' | 'rejected') {
    return this.database.asAdmin(async (tx) => {
      // Rejecting also unpublishes; approving leaves the owner's is_public choice intact.
      const patch = decision === 'rejected' ? { moderation: decision, isPublic: false } : { moderation: decision };
      const [updated] = await tx
        .update(schema.comics)
        .set(patch)
        .where(eq(schema.comics.id, comicId))
        .returning({ id: schema.comics.id, moderation: schema.comics.moderation });
      if (!updated) throw AppError.notFound('Comic');
      await tx.insert(schema.auditLogs).values({
        actorId: adminId,
        action: `moderate_comic:${decision}`,
        entity: 'comic',
        entityId: comicId,
      });
      return updated;
    });
  }

  async grantCredits(adminId: string, userId: string, amount: number, reason: string) {
    await this.database.asAdmin(async (tx) => {
      await this.credits.grant(tx, userId, amount, `admin_grant:${reason}`, `${adminId}:${Date.now()}`);
      await tx.insert(schema.auditLogs).values({
        actorId: adminId,
        action: 'grant_credits',
        entity: 'user',
        entityId: userId,
        meta: { amount, reason },
      });
    });
    return { status: 'granted' as const, amount };
  }

  async metrics() {
    return this.database.asAdmin(async (tx) => {
      const [users] = await tx.select({ n: sql<number>`count(*)` }).from(schema.users);
      const [comics] = await tx.select({ n: sql<number>`count(*)` }).from(schema.comics);
      const [openReports] = await tx
        .select({ n: sql<number>`count(*)` })
        .from(schema.reports)
        .where(eq(schema.reports.status, 'open'));
      return {
        users: Number(users?.n ?? 0),
        comics: Number(comics?.n ?? 0),
        openReports: Number(openReports?.n ?? 0),
      };
    });
  }
}
