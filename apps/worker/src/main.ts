import { createAiService } from '@storyme/ai';
import { loadServerEnv } from '@storyme/config';
import { getDb, withUserContext } from '@storyme/database';
import { JOB_QUEUE_NAME, JobType } from '@storyme/shared-types';
import { Worker } from 'bullmq';
import pino from 'pino';
import { ComicPipeline, type PipelineDeps } from './pipeline.js';
import { S3StorageUploader } from './storage.js';
import { ChannelNotifier, ExpoPushSender, ResendEmailSender } from './notifications.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

function main(): void {
  const env = loadServerEnv();
  const db = getDb();
  const runAsAdmin: PipelineDeps['runAsAdmin'] = (fn) => withUserContext(db, null, fn, { isAdmin: true });

  const ai = createAiService(env, (usage) => {
    // Usage metering hook — emit to metrics / cost tracking.
    logger.info({ usage }, 'ai_usage');
  });

  // Notification channels — each is enabled only when configured.
  const push = new ExpoPushSender(logger);
  const email = env.RESEND_API_KEY
    ? new ResendEmailSender(env.RESEND_API_KEY, 'StoryMe <no-reply@storyme.app>', logger)
    : null;
  const notifier = new ChannelNotifier(runAsAdmin, logger, push, email);

  const pipeline = new ComicPipeline({
    db,
    runAsAdmin,
    ai,
    uploader: new S3StorageUploader(env),
    logger,
    notifier,
  });

  const worker = new Worker(
    JOB_QUEUE_NAME,
    async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'processing job');
      switch (job.name) {
        case JobType.GenerateComic:
          await pipeline.generateComic(job.data.comicId as string);
          break;
        case JobType.Notify:
        case JobType.Cleanup:
        case JobType.Export:
          logger.info({ name: job.name, data: job.data }, 'job type not yet implemented; acking');
          break;
        default:
          logger.warn({ name: job.name }, 'unknown job type');
      }
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 4),
    },
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'job completed'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'job failed'));

  logger.info('StoryMe worker started');

  const shutdown = async (): Promise<void> => {
    logger.info('shutting down worker');
    await worker.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
