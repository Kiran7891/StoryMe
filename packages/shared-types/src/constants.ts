/** Product-wide constants shared across all apps. Keep in sync with API validation. */

export const UPLOAD_LIMITS = {
  MAX_FILE_BYTES: 15 * 1024 * 1024, // 15 MB per photo
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const,
  MIN_PHOTOS_PER_CHARACTER: 1,
  MAX_PHOTOS_PER_CHARACTER: 8,
} as const;

export const COMIC_LIMITS = {
  MIN_PANELS: 4,
  MAX_PANELS: 12,
  DEFAULT_PANELS: 6,
  MAX_PROMPT_CHARS: 2000,
  MIN_PROMPT_CHARS: 3,
} as const;

/** Credit cost model (1 comic = MIN..MAX panels). Debited from the credit ledger. */
export const CREDIT_COST = {
  PER_COMIC_BASE: 1,
  PER_PANEL: 1,
} as const;

/** Monthly entitlements per plan. Enforced server-side only. */
export const PLAN_ENTITLEMENTS = {
  free: { monthlyComics: 1, maxPanels: 4, watermark: true, priority: false },
  plus: { monthlyComics: 15, maxPanels: 8, watermark: false, priority: false },
  pro: { monthlyComics: 50, maxPanels: 12, watermark: false, priority: true },
} as const;

export const API_VERSION = 'v1' as const;
export const IDEMPOTENCY_HEADER = 'Idempotency-Key' as const;
export const REQUEST_ID_HEADER = 'X-Request-Id' as const;
