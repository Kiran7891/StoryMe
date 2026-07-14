/**
 * Canonical enums shared across API, web, mobile, and admin.
 * Keep values stable — they are persisted in the database and sent over the wire.
 */

export const UserRole = {
  User: 'user',
  Admin: 'admin',
  Support: 'support',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const CharacterKind = {
  Person: 'person',
  Child: 'child',
  Pet: 'pet',
  Other: 'other',
} as const;
export type CharacterKind = (typeof CharacterKind)[keyof typeof CharacterKind];

export const ComicStyle = {
  Manga: 'manga',
  Superhero: 'superhero',
  Chibi: 'chibi',
  Noir: 'noir',
  Watercolor: 'watercolor',
} as const;
export type ComicStyle = (typeof ComicStyle)[keyof typeof ComicStyle];

export const ComicStatus = {
  Draft: 'draft',
  Queued: 'queued',
  Processing: 'processing',
  Complete: 'complete',
  Failed: 'failed',
  Moderated: 'moderated',
} as const;
export type ComicStatus = (typeof ComicStatus)[keyof typeof ComicStatus];

export const JobType = {
  GenerateComic: 'generate_comic',
  GenerateScript: 'generate_script',
  GeneratePanel: 'generate_panel',
  AssembleComic: 'assemble_comic',
  Notify: 'notify',
  Cleanup: 'cleanup',
  Export: 'export',
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];

export const JobStatus = {
  Queued: 'queued',
  Active: 'active',
  Completed: 'completed',
  Failed: 'failed',
  Cancelled: 'cancelled',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const UploadStatus = {
  Pending: 'pending',
  Uploaded: 'uploaded',
  Rejected: 'rejected',
} as const;
export type UploadStatus = (typeof UploadStatus)[keyof typeof UploadStatus];

export const SubscriptionPlan = {
  Free: 'free',
  Plus: 'plus',
  Pro: 'pro',
} as const;
export type SubscriptionPlan = (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];
