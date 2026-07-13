import { z } from 'zod';

/**
 * Server-side environment schema. Validated once at process boot; the app should
 * crash fast with a readable message if anything required is missing or malformed.
 * NEVER import this into a browser/mobile bundle — it expects server secrets.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  API_BASE_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_URL: z.string().url().optional(),

  // Redis / queue
  REDIS_URL: z.string().url(),

  // Auth (Supabase)
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  SUPABASE_JWKS_URL: z.string().url().optional(),

  // Object storage (Cloudflare R2 / S3-compatible)
  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_PUBLIC_BASE_URL: z.string().url(),

  // AI providers (server-only)
  AI_TEXT_PROVIDER: z.enum(['fireworks', 'together', 'openai', 'mock']).default('mock'),
  AI_IMAGE_PROVIDER: z.enum(['replicate', 'modal', 'mock']).default('mock'),
  AI_TEXT_API_KEY: z.string().optional(),
  AI_IMAGE_API_KEY: z.string().optional(),
  AI_DAILY_SPEND_CAP_USD: z.coerce.number().positive().default(100),

  // Payments
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),

  // Integrations
  RESEND_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  POSTHOG_API_KEY: z.string().optional(),

  // Security
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  CORS_ORIGINS: z.string().default('*'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Parse and validate `process.env` (or a provided source). Throws with a clear,
 * aggregated message listing every invalid/missing variable.
 */
export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid server environment configuration:\n${issues}`);
  }
  return parsed.data;
}
