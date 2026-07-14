import { describe, expect, it } from 'vitest';
import { loadServerEnv } from './env';

const baseEnv = {
  NODE_ENV: 'test',
  API_BASE_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/storyme',
  REDIS_URL: 'redis://localhost:6379',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  STORAGE_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
  STORAGE_BUCKET: 'storyme',
  STORAGE_ACCESS_KEY_ID: 'key',
  STORAGE_SECRET_ACCESS_KEY: 'secret',
  STORAGE_PUBLIC_BASE_URL: 'https://cdn.storyme.app',
};

describe('loadServerEnv', () => {
  it('parses a complete environment and applies defaults', () => {
    const env = loadServerEnv(baseEnv as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(3001);
    expect(env.AI_IMAGE_PROVIDER).toBe('mock');
  });

  it('throws a descriptive error when a required var is missing', () => {
    const { DATABASE_URL: _omit, ...incomplete } = baseEnv;
    expect(() => loadServerEnv(incomplete as NodeJS.ProcessEnv)).toThrowError(
      /DATABASE_URL/,
    );
  });
});
