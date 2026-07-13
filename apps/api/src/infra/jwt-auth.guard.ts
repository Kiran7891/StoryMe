import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { schema } from '@storyme/database';
import type { UserRole } from '@storyme/shared-types';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { AppError } from '../common/app-error.js';
import { type AuthUser, IS_PUBLIC_KEY } from '../common/decorators.js';
import { DatabaseService } from './database.module.js';
import { TokenVerifier } from './token-verifier.js';

/**
 * Verifies the Bearer JWT, resolves (or provisions) the app user by auth subject,
 * and attaches it to the request. Routes marked @Public() skip verification.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifier,
    private readonly database: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(req);

    // Public routes still attach a user when a valid token is present (optional auth).
    if (!token) {
      if (isPublic) return true;
      throw AppError.unauthorized('Missing bearer token');
    }

    const claims = await this.verifier.verify(token);
    req.user = await this.resolveUser(claims.sub, claims.email);
    return true;
  }

  private extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length).trim() || null;
  }

  /** Find the user by auth subject, provisioning a new row on first sign-in. */
  private async resolveUser(authSub: string, email: string): Promise<AuthUser> {
    return this.database.asAdmin(async (tx) => {
      const existing = await tx
        .select({ id: schema.users.id, email: schema.users.email, role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.authSub, authSub))
        .limit(1);

      if (existing[0]) {
        return { ...existing[0], role: existing[0].role as UserRole, authSub };
      }

      const inserted = await tx
        .insert(schema.users)
        .values({ email, authSub })
        .onConflictDoUpdate({ target: schema.users.email, set: { authSub } })
        .returning({ id: schema.users.id, email: schema.users.email, role: schema.users.role });

      const user = inserted[0];
      if (!user) throw AppError.unauthorized('Failed to provision user');
      return { ...user, role: user.role as UserRole, authSub };
    });
  }
}
