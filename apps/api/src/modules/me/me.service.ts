import { Injectable } from '@nestjs/common';
import { schema } from '@storyme/database';
import { JobType, PLAN_ENTITLEMENTS, type SubscriptionPlan } from '@storyme/shared-types';
import type { RegisterDeviceInput, UpdateProfileInput } from '@storyme/validation';
import { eq } from 'drizzle-orm';
import { AppError } from '../../common/app-error.js';
import { DatabaseService } from '../../infra/database.module.js';
import { QueueService } from '../../infra/queue.module.js';
import { CreditsService } from '../credits/credits.service.js';

@Injectable()
export class MeService {
  constructor(
    private readonly database: DatabaseService,
    private readonly credits: CreditsService,
    private readonly queue: QueueService,
  ) {}

  async getProfile(userId: string) {
    return this.database.asUser(userId, async (tx) => {
      const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      if (!user) throw AppError.notFound('User');
      const [billing] = await tx
        .select()
        .from(schema.billingAccounts)
        .where(eq(schema.billingAccounts.userId, userId))
        .limit(1);
      const plan = (billing?.plan ?? 'free') as SubscriptionPlan;
      const balance = await this.credits.getBalance(tx, userId);
      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        handle: user.handle,
        avatarKey: user.avatarKey,
        bio: user.bio,
        role: user.role,
        plan,
        entitlements: PLAN_ENTITLEMENTS[plan],
        credits: balance,
      };
    });
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    return this.database.asUser(userId, async (tx) => {
      const [updated] = await tx
        .update(schema.users)
        .set({
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.marketingOptIn !== undefined ? { marketingOptIn: input.marketingOptIn } : {}),
        })
        .where(eq(schema.users.id, userId))
        .returning();
      if (!updated) throw AppError.notFound('User');
      return { id: updated.id, displayName: updated.displayName, marketingOptIn: updated.marketingOptIn };
    });
  }

  /** GDPR erasure — soft-delete now, purge media + rows asynchronously. */
  async requestDeletion(userId: string) {
    await this.database.asUser(userId, (tx) =>
      tx.update(schema.users).set({ deletedAt: new Date() }).where(eq(schema.users.id, userId)),
    );
    await this.queue.enqueue(JobType.Cleanup, { kind: 'account_deletion', userId }, {
      jobId: `account-deletion-${userId}`,
    });
    return { status: 'scheduled' as const };
  }

  /** GDPR portability — assemble an export bundle asynchronously. */
  async requestExport(userId: string) {
    await this.queue.enqueue(JobType.Export, { kind: 'data_export', userId }, {
      jobId: `data-export-${userId}-${Date.now()}`,
    });
    return { status: 'processing' as const };
  }

  async registerDevice(userId: string, input: RegisterDeviceInput) {
    await this.database.asUser(userId, (tx) =>
      tx
        .insert(schema.devices)
        .values({ userId, platform: input.platform, pushToken: input.pushToken })
        .onConflictDoNothing({ target: [schema.devices.userId, schema.devices.pushToken] }),
    );
    return { status: 'registered' as const };
  }
}
