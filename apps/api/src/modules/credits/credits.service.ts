import { Injectable } from '@nestjs/common';
import { type Database, schema } from '@storyme/database';
import { and, eq, sql } from 'drizzle-orm';
import { AppError } from '../../common/app-error.js';

/**
 * Credits are an append-only ledger; balance = SUM(delta). Reservations (debits) and
 * grants (credits) are ledger rows keyed by (reason, ref_id) so the same logical event
 * can never double-charge or double-grant. All methods operate within a caller-provided
 * transaction so they compose atomically with the surrounding operation.
 */
@Injectable()
export class CreditsService {
  async getBalance(tx: Database, userId: string): Promise<number> {
    const rows = await tx
      .select({ balance: sql<number>`COALESCE(SUM(${schema.creditLedger.delta}), 0)` })
      .from(schema.creditLedger)
      .where(eq(schema.creditLedger.userId, userId));
    return Number(rows[0]?.balance ?? 0);
  }

  /** Debit `amount` credits, failing if the balance is insufficient. Idempotent per refId. */
  async reserve(
    tx: Database,
    userId: string,
    amount: number,
    reason: string,
    refId: string,
  ): Promise<void> {
    if (amount <= 0) return;
    if (await this.alreadyPosted(tx, reason, refId)) return; // idempotent replay
    const balance = await this.getBalance(tx, userId);
    if (balance < amount) throw AppError.insufficientCredits();
    await tx.insert(schema.creditLedger).values({ userId, delta: -amount, reason, refId });
  }

  /** Grant `amount` credits. Idempotent per refId. */
  async grant(
    tx: Database,
    userId: string,
    amount: number,
    reason: string,
    refId: string,
  ): Promise<void> {
    if (amount <= 0) return;
    if (await this.alreadyPosted(tx, reason, refId)) return;
    await tx.insert(schema.creditLedger).values({ userId, delta: amount, reason, refId });
  }

  private async alreadyPosted(tx: Database, reason: string, refId: string): Promise<boolean> {
    const rows = await tx
      .select({ id: schema.creditLedger.id })
      .from(schema.creditLedger)
      .where(and(eq(schema.creditLedger.reason, reason), eq(schema.creditLedger.refId, refId)))
      .limit(1);
    return rows.length > 0;
  }
}
