import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@storyme/shared-types';
import { AppError } from '../common/app-error.js';
import { type AuthUser, ROLES_KEY } from '../common/decorators.js';

/** Enforces @Roles(...) metadata against the authenticated user's role. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user || !required.includes(req.user.role)) {
      throw AppError.forbidden('Insufficient role');
    }
    return true;
  }
}
