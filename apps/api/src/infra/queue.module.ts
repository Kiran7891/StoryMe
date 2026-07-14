import { Global, Injectable, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import { JOB_QUEUE_NAME, type JobType } from '@storyme/shared-types';
import { Queue } from 'bullmq';
import { env } from './env.js';

export const QUEUE_NAME = JOB_QUEUE_NAME;

export interface EnqueueOptions {
  jobId?: string; // dedupe/idempotency at the queue level
  priority?: number;
  delayMs?: number;
}

/**
 * Publishes background jobs to the BullMQ queue consumed by the worker app (Phase 9).
 * The Redis connection is created lazily on first enqueue so the API can boot (and
 * serve health checks) even if Redis is temporarily unavailable.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger('QueueService');
  private queue: Queue | null = null;

  private getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue(QUEUE_NAME, {
        connection: { url: env().REDIS_URL },
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 86400 },
        },
      });
    }
    return this.queue;
  }

  async enqueue(
    type: JobType,
    payload: Record<string, unknown>,
    opts: EnqueueOptions = {},
  ): Promise<void> {
    await this.getQueue().add(type, payload, {
      jobId: opts.jobId,
      priority: opts.priority,
      delay: opts.delayMs,
    });
    this.logger.log(`enqueued ${type} ${opts.jobId ?? ''}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queue) await this.queue.close();
  }
}

@Global()
@Module({ providers: [QueueService], exports: [QueueService] })
export class QueueModule {}
