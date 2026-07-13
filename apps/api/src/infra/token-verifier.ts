import { Injectable, Logger } from '@nestjs/common';
import { ErrorCode } from '@storyme/shared-types';
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from 'jose';
import { AppError } from '../common/app-error.js';
import { env } from './env.js';

export interface VerifiedClaims {
  sub: string;
  email: string;
  role?: string;
}

/**
 * Provider-agnostic JWT verification. Supports asymmetric (JWKS, recommended for
 * production) and symmetric (HS256 shared secret, convenient for local/dev and the
 * classic Supabase JWT secret). Configure via SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET.
 */
@Injectable()
export class TokenVerifier {
  private readonly logger = new Logger('TokenVerifier');
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
  private hmacKey: Uint8Array | null = null;

  constructor() {
    const e = env();
    if (e.SUPABASE_JWKS_URL) {
      this.jwks = createRemoteJWKSet(new URL(e.SUPABASE_JWKS_URL));
    } else if (e.SUPABASE_JWT_SECRET) {
      this.hmacKey = new TextEncoder().encode(e.SUPABASE_JWT_SECRET);
    } else {
      this.logger.warn('No SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET set — auth will reject all tokens');
    }
  }

  async verify(token: string): Promise<VerifiedClaims> {
    try {
      let payload: JWTPayload;
      if (this.jwks) {
        ({ payload } = await jwtVerify(token, this.jwks));
      } else if (this.hmacKey) {
        ({ payload } = await jwtVerify(token, this.hmacKey));
      } else {
        throw AppError.unauthorized('Auth is not configured');
      }
      const sub = typeof payload.sub === 'string' ? payload.sub : undefined;
      const email = typeof payload.email === 'string' ? payload.email : undefined;
      if (!sub || !email) throw new AppError(ErrorCode.Unauthorized, 'Token missing sub/email');
      const role = typeof payload.role === 'string' ? payload.role : undefined;
      return { sub, email, role };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(ErrorCode.TokenExpired, 'Invalid or expired token');
    }
  }
}
