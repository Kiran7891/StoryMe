import { z } from 'zod';
import {
  CharacterKind,
  ComicStyle,
  COMIC_LIMITS,
  UPLOAD_LIMITS,
} from '@storyme/shared-types';

/** Reusable primitives */
export const uuidSchema = z.string().uuid();

const characterKindValues = Object.values(CharacterKind) as [string, ...string[]];
const comicStyleValues = Object.values(ComicStyle) as [string, ...string[]];
const allowedMime = UPLOAD_LIMITS.ALLOWED_MIME_TYPES as readonly string[];

/** POST /v1/uploads */
export const createUploadSchema = z.object({
  mimeType: z
    .string()
    .refine((m) => allowedMime.includes(m), { message: 'Unsupported image type' }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(UPLOAD_LIMITS.MAX_FILE_BYTES, { message: 'File exceeds size limit' }),
  fileName: z.string().min(1).max(255).optional(),
});
export type CreateUploadInput = z.infer<typeof createUploadSchema>;

/** POST /v1/characters */
export const createCharacterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(characterKindValues),
  uploadIds: z
    .array(uuidSchema)
    .min(UPLOAD_LIMITS.MIN_PHOTOS_PER_CHARACTER)
    .max(UPLOAD_LIMITS.MAX_PHOTOS_PER_CHARACTER),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Consent to process likeness is required' }),
  }),
});
export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;

/** POST /v1/comics */
export const createComicSchema = z.object({
  characterId: uuidSchema,
  prompt: z
    .string()
    .trim()
    .min(COMIC_LIMITS.MIN_PROMPT_CHARS)
    .max(COMIC_LIMITS.MAX_PROMPT_CHARS),
  style: z.enum(comicStyleValues),
  format: z.enum(['book', 'reel']).default('book'),
  panelCount: z
    .number()
    .int()
    .min(COMIC_LIMITS.MIN_PANELS)
    .max(COMIC_LIMITS.MAX_PANELS)
    .default(COMIC_LIMITS.DEFAULT_PANELS),
  title: z.string().trim().max(120).optional(),
});
export type CreateComicInput = z.infer<typeof createComicSchema>;

/** PATCH /v1/me */
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  marketingOptIn: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** POST /v1/comics/:id/share */
export const shareComicSchema = z.object({
  isPublic: z.boolean(),
});
export type ShareComicInput = z.infer<typeof shareComicSchema>;

/** POST /v1/comics/:id/comments */
export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  parentId: uuidSchema.optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

/** POST /v1/comics/:id/repost */
export const repostSchema = z.object({
  caption: z.string().trim().max(500).optional(),
});
export type RepostInput = z.infer<typeof repostSchema>;

/** POST /v1/comics/:id/report and /v1/comments/:id/report */
export const reportSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
export type ReportInput = z.infer<typeof reportSchema>;

/** POST /v1/notifications/register-device */
export const registerDeviceSchema = z.object({
  platform: z.enum(['ios', 'android', 'web']),
  pushToken: z.string().min(1).max(512),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

/** Pagination query */
export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;
