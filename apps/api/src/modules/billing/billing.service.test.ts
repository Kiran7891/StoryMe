import { describe, expect, it, beforeAll } from 'vitest';
import type Stripe from 'stripe';

// Integration test — only runs when a Postgres DATABASE_URL is provided.
const hasDb = !!process.env.DATABASE_URL;

// Populate the minimal server env before any module reads it.
Object.assign(process.env, {
  NODE_ENV: 'test',
  API_BASE_URL: 'http://localhost:3001',
  REDIS_URL: 'redis://localhost:6379',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  STORAGE_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
  STORAGE_BUCKET: 'b',
  STORAGE_ACCESS_KEY_ID: 'k',
  STORAGE_SECRET_ACCESS_KEY: 's',
  STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
});

describe.skipIf(!hasDb)('BillingService.handleStripeEvent (integration)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let billing: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let schema: typeof import('@storyme/database').schema;
  let userId: string;

  beforeAll(async () => {
    const dbMod = await import('@storyme/database');
    const { DatabaseService } = await import('../../infra/database.module.js');
    const { CreditsService } = await import('../credits/credits.service.js');
    const { BillingService } = await import('./billing.service.js');
    schema = dbMod.schema;

    const database = new DatabaseService();
    db = database;
    billing = new BillingService(database, new CreditsService());

    const created = (await database.asAdmin((tx: typeof db.db) =>
      tx
        .insert(schema.users)
        .values({ email: `bill-${Date.now()}@t.co`, authSub: `s-${Math.random()}` })
        .returning({ id: schema.users.id }),
    )) as Array<{ id: string }>;
    userId = created[0]!.id;
  });

  function checkoutEvent(plan: string): Stripe.Event {
    return {
      id: `evt_${Date.now()}_${Math.random()}`,
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId, plan }, customer: 'cus_test' } },
    } as unknown as Stripe.Event;
  }

  it('applies the plan on first delivery and is idempotent on replay', async () => {
    const event = checkoutEvent('plus');

    const first = await billing.handleStripeEvent(event);
    expect(first.handled).toBe(true);

    const second = await billing.handleStripeEvent(event); // same id → ignored
    expect(second.handled).toBe(false);

    const { eq } = await import('drizzle-orm');
    const rows = await db.asAdmin((tx: typeof db.db) =>
      tx.select().from(schema.billingAccounts).where(eq(schema.billingAccounts.userId, userId)).limit(1),
    );
    expect(rows[0].plan).toBe('plus');
  });
});
