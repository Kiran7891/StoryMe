/**
 * Drizzle typed schema — mirrors the authoritative SQL in ../migrations for typed
 * query building in the API/worker. The SQL migrations remain the source of truth
 * (RLS, triggers, checks); keep these definitions in sync when migrations change.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  authSub: text('auth_sub').unique(),
  displayName: text('display_name'),
  handle: text('handle').unique(),
  avatarKey: text('avatar_key'),
  bio: text('bio'),
  role: text('role').notNull().default('user'),
  marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
  createdAt,
  updatedAt,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const uploads = pgTable('uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt,
  updatedAt,
});

export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  identityRef: jsonb('identity_ref').notNull().default(sql`'{}'::jsonb`),
  consentAt: timestamp('consent_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt,
  updatedAt,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const characterPhotos = pgTable(
  'character_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    characterId: uuid('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
    uploadId: uuid('upload_id').notNull().references(() => uploads.id),
    status: text('status').notNull().default('pending'),
    createdAt,
  },
  (t) => ({ uq: unique().on(t.characterId, t.uploadId) }),
);

export const comics = pgTable('comics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  characterId: uuid('character_id').references(() => characters.id, { onDelete: 'set null' }),
  title: text('title'),
  prompt: text('prompt').notNull(),
  style: text('style').notNull(),
  format: text('format').notNull().default('book'),
  status: text('status').notNull().default('draft'),
  panelCount: integer('panel_count').notNull().default(6),
  coverKey: text('cover_key'),
  videoKey: text('video_key'),
  isPublic: boolean('is_public').notNull().default(false),
  shareSlug: text('share_slug').unique(),
  moderation: text('moderation').notNull().default('pending'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt,
  updatedAt,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const panels = pgTable(
  'panels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    comicId: uuid('comic_id').notNull().references(() => comics.id, { onDelete: 'cascade' }),
    index: integer('index').notNull(),
    scene: text('scene'),
    dialogue: jsonb('dialogue').notNull().default(sql`'[]'::jsonb`),
    imageKey: text('image_key'),
    durationMs: integer('duration_ms'),
    status: text('status').notNull().default('pending'),
    createdAt,
  },
  (t) => ({ uq: unique().on(t.comicId, t.index) }),
);

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  comicId: uuid('comic_id').references(() => comics.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  status: text('status').notNull().default('queued'),
  progress: integer('progress').notNull().default(0),
  attempts: integer('attempts').notNull().default(0),
  error: jsonb('error'),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt,
  updatedAt,
});

export const billingAccounts = pgTable('billing_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').unique(),
  plan: text('plan').notNull().default('free'),
  status: text('status').notNull().default('active'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt,
  updatedAt,
});

export const creditLedger = pgTable('credit_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(),
  refId: text('ref_id'),
  createdAt,
});

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    pushToken: text('push_token').notNull(),
    createdAt,
  },
  (t) => ({ uq: unique().on(t.userId, t.pushToken) }),
);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  data: jsonb('data').notNull().default(sql`'{}'::jsonb`),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt,
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id'),
  action: text('action').notNull(),
  entity: text('entity'),
  entityId: text('entity_id'),
  meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
  createdAt,
});

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  responseHash: text('response_hash'),
  responseBody: jsonb('response_body'),
  statusCode: integer('status_code'),
  createdAt,
});

export const processedWebhookEvents = pgTable('processed_webhook_events', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  createdAt,
});

// --- Social ---
export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    followeeId: uuid('followee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => ({ pk: primaryKey({ columns: [t.followerId, t.followeeId] }) }),
);

export const likes = pgTable(
  'likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    comicId: uuid('comic_id').notNull().references(() => comics.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => ({ uq: unique().on(t.userId, t.comicId) }),
);

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  comicId: uuid('comic_id').notNull().references(() => comics.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  body: text('body').notNull(),
  moderation: text('moderation').notNull().default('approved'),
  createdAt,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const reposts = pgTable(
  'reposts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    comicId: uuid('comic_id').notNull().references(() => comics.id, { onDelete: 'cascade' }),
    caption: text('caption'),
    createdAt,
  },
  (t) => ({ uq: unique().on(t.userId, t.comicId) }),
);

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  comicId: uuid('comic_id').references(() => comics.id, { onDelete: 'cascade' }),
  commentId: uuid('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('open'),
  createdAt,
});

export const comicStats = pgTable('comic_stats', {
  comicId: uuid('comic_id').primaryKey().references(() => comics.id, { onDelete: 'cascade' }),
  likeCount: integer('like_count').notNull().default(0),
  commentCount: integer('comment_count').notNull().default(0),
  repostCount: integer('repost_count').notNull().default(0),
  viewCount: bigint('view_count', { mode: 'number' }).notNull().default(0),
});
