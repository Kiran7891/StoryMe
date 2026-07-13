import { loadServerEnv, type ServerEnv } from '@storyme/config';

/** Injection token for the validated server environment. */
export const ENV = Symbol('ENV');

let cached: ServerEnv | null = null;

/** Load and validate the environment exactly once (fail-fast at boot). */
export function env(): ServerEnv {
  if (!cached) cached = loadServerEnv();
  return cached;
}
