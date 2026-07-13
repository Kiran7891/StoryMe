import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { schema } from '@storyme/database';
import { ErrorCode, IDEMPOTENCY_HEADER } from '@storyme/shared-types';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { from, of, type Observable, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { AppError } from './app-error.js';
import type { AuthUser } from './decorators.js';
import { DatabaseService } from '../infra/database.module.js';

/** Claims older than this with no stored response are considered abandoned. */
const STALE_CLAIM_MS = 5 * 60 * 1000;

/**
 * Server-side enforcement of the Idempotency-Key header on mutating requests,
 * using a claim-first pattern so concurrent retries can never double-execute:
 *
 *  1. INSERT the key (a claim). If we won the claim → execute the handler and
 *     store the response on success (or release the claim on failure).
 *  2. If the key already exists with a stored response → replay it verbatim.
 *  3. If the key exists but is still in flight → 409 so the client backs off.
 *
 * Keys are scoped per user + route, so the same UUID from different users or
 * endpoints never collides.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly database: DatabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const res = context.switchToHttp().getResponse<Response>();

    const rawKey = req.headers[IDEMPOTENCY_HEADER.toLowerCase()];
    if (req.method !== 'POST' || typeof rawKey !== 'string' || rawKey.length === 0) {
      return next.handle();
    }

    const userId = req.user?.id ?? null;
    const key = `${userId ?? 'anon'}:${req.path}:${rawKey}`.slice(0, 512);

    return from(this.claimOrReplay(key, userId)).pipe(
      switchMap((state) => {
        if (state.kind === 'replay') {
          res.status(state.statusCode);
          return of(state.body);
        }
        if (state.kind === 'in_flight') {
          return throwError(
            () =>
              new AppError(ErrorCode.Conflict, 'A request with this idempotency key is already in progress'),
          );
        }
        // We own the claim: execute, persist the response, or release on failure.
        return next.handle().pipe(
          tap((body) => void this.storeResponse(key, res.statusCode, body)),
          catchError((err) => from(this.releaseClaim(key)).pipe(switchMap(() => throwError(() => err)))),
        );
      }),
    );
  }

  private async claimOrReplay(
    key: string,
    userId: string | null,
  ): Promise<
    | { kind: 'claimed' }
    | { kind: 'in_flight' }
    | { kind: 'replay'; statusCode: number; body: unknown }
  > {
    return this.database.asAdmin(async (tx) => {
      // Sweep abandoned claims so a crashed request doesn't wedge the key forever.
      await tx
        .delete(schema.idempotencyKeys)
        .where(
          and(
            eq(schema.idempotencyKeys.key, key),
            isNull(schema.idempotencyKeys.responseBody),
            lt(schema.idempotencyKeys.createdAt, new Date(Date.now() - STALE_CLAIM_MS)),
          ),
        );

      const claimed = await tx
        .insert(schema.idempotencyKeys)
        .values({ key, userId })
        .onConflictDoNothing()
        .returning({ key: schema.idempotencyKeys.key });
      if (claimed.length > 0) return { kind: 'claimed' as const };

      const [existing] = await tx
        .select()
        .from(schema.idempotencyKeys)
        .where(eq(schema.idempotencyKeys.key, key))
        .limit(1);
      if (existing?.responseBody != null) {
        return {
          kind: 'replay' as const,
          statusCode: existing.statusCode ?? 200,
          body: existing.responseBody,
        };
      }
      return { kind: 'in_flight' as const };
    });
  }

  private async storeResponse(key: string, statusCode: number, body: unknown): Promise<void> {
    await this.database.asAdmin((tx) =>
      tx
        .update(schema.idempotencyKeys)
        .set({ statusCode, responseBody: body ?? sql`'null'::jsonb` })
        .where(eq(schema.idempotencyKeys.key, key)),
    );
  }

  private async releaseClaim(key: string): Promise<void> {
    await this.database.asAdmin((tx) =>
      tx.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.key, key)),
    );
  }
}
