/**
 * Canonical error model shared by the API and all clients.
 * The API always responds to failures with an `ApiErrorBody`.
 */

export const ErrorCode = {
  // Auth
  Unauthorized: 'unauthorized',
  Forbidden: 'forbidden',
  TokenExpired: 'token_expired',
  // Validation
  ValidationFailed: 'validation_failed',
  // Resources
  NotFound: 'not_found',
  Conflict: 'conflict',
  // Rate / quota
  RateLimited: 'rate_limited',
  QuotaExceeded: 'quota_exceeded',
  InsufficientCredits: 'insufficient_credits',
  // Uploads / media
  UnsupportedMediaType: 'unsupported_media_type',
  FileTooLarge: 'file_too_large',
  // Moderation
  ContentBlocked: 'content_blocked',
  // AI / jobs
  GenerationFailed: 'generation_failed',
  // Billing
  PaymentFailed: 'payment_failed',
  WebhookInvalid: 'webhook_invalid',
  // Generic
  Internal: 'internal_error',
  ServiceUnavailable: 'service_unavailable',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId: string;
}

/** Default HTTP status for each error code (used by the API error filter). */
export const ErrorHttpStatus: Record<ErrorCode, number> = {
  [ErrorCode.Unauthorized]: 401,
  [ErrorCode.Forbidden]: 403,
  [ErrorCode.TokenExpired]: 401,
  [ErrorCode.ValidationFailed]: 422,
  [ErrorCode.NotFound]: 404,
  [ErrorCode.Conflict]: 409,
  [ErrorCode.RateLimited]: 429,
  [ErrorCode.QuotaExceeded]: 429,
  [ErrorCode.InsufficientCredits]: 402,
  [ErrorCode.UnsupportedMediaType]: 415,
  [ErrorCode.FileTooLarge]: 413,
  [ErrorCode.ContentBlocked]: 422,
  [ErrorCode.GenerationFailed]: 500,
  [ErrorCode.PaymentFailed]: 402,
  [ErrorCode.WebhookInvalid]: 400,
  [ErrorCode.Internal]: 500,
  [ErrorCode.ServiceUnavailable]: 503,
};
