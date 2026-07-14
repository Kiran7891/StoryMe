import { Injectable, Logger } from '@nestjs/common';
import { schema } from '@storyme/database';
import { ErrorCode, type SubscriptionPlan } from '@storyme/shared-types';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { AppError } from '../../common/app-error.js';
import { DatabaseService } from '../../infra/database.module.js';
import { env } from '../../infra/env.js';
import { CreditsService } from '../credits/credits.service.js';

const PLAN_PRICE: Partial<Record<SubscriptionPlan, string | undefined>> = {};

@Injectable()
export class BillingService {
  private readonly logger = new Logger('BillingService');
  private readonly stripe: Stripe | null;

  constructor(
    private readonly database: DatabaseService,
    private readonly credits: CreditsService,
  ) {
    const key = env().STRIPE_SECRET_KEY;
    this.stripe = key ? new Stripe(key) : null;
    PLAN_PRICE.plus = env().STRIPE_PRICE_PLUS;
    PLAN_PRICE.pro = env().STRIPE_PRICE_PRO;
  }

  private requireStripe(): Stripe {
    if (!this.stripe) throw new AppError(ErrorCode.ServiceUnavailable, 'Payments are not configured');
    return this.stripe;
  }

  /** Create a Stripe Checkout session for a subscription plan. */
  async createCheckout(userId: string, email: string, plan: 'plus' | 'pro') {
    const stripe = this.requireStripe();
    const price = PLAN_PRICE[plan];
    if (!price) throw new AppError(ErrorCode.ServiceUnavailable, `No price configured for ${plan}`);

    const customerId = await this.ensureCustomer(userId, email);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${env().WEB_BASE_URL}/billing/success`,
      cancel_url: `${env().WEB_BASE_URL}/billing/cancel`,
      metadata: { userId, plan },
      subscription_data: { metadata: { userId, plan } },
    });
    return { url: session.url };
  }

  async createPortal(userId: string, email: string) {
    const stripe = this.requireStripe();
    const customerId = await this.ensureCustomer(userId, email);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env().WEB_BASE_URL}/settings/billing`,
    });
    return { url: session.url };
  }

  async getSubscription(userId: string) {
    return this.database.asUser(userId, async (tx) => {
      const [billing] = await tx
        .select()
        .from(schema.billingAccounts)
        .where(eq(schema.billingAccounts.userId, userId))
        .limit(1);
      return {
        plan: (billing?.plan ?? 'free') as SubscriptionPlan,
        status: billing?.status ?? 'active',
        currentPeriodEnd: billing?.currentPeriodEnd ?? null,
      };
    });
  }

  /** Verify a Stripe webhook signature and return the parsed event. */
  verifyStripeEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = env().STRIPE_WEBHOOK_SECRET;
    const stripe = this.requireStripe();
    if (!secret) throw new AppError(ErrorCode.WebhookInvalid, 'Webhook secret not configured');
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new AppError(ErrorCode.WebhookInvalid, 'Invalid webhook signature');
    }
  }

  /**
   * Handle a verified Stripe event. Idempotent: each event id is processed at most
   * once. Entitlement/credit changes are applied server-side only.
   */
  async handleStripeEvent(event: Stripe.Event): Promise<{ handled: boolean }> {
    return this.database.asAdmin(async (tx) => {
      // Idempotency guard.
      const seen = await tx
        .insert(schema.processedWebhookEvents)
        .values({ id: event.id, provider: 'stripe' })
        .onConflictDoNothing()
        .returning({ id: schema.processedWebhookEvents.id });
      if (seen.length === 0) return { handled: false }; // already processed

      switch (event.type) {
        case 'checkout.session.completed': {
          const s = event.data.object as Stripe.Checkout.Session;
          const userId = s.metadata?.userId;
          const plan = s.metadata?.plan as SubscriptionPlan | undefined;
          if (userId && plan) await this.setPlan(tx, userId, plan, (s.customer as string) ?? null);
          break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.created': {
          const sub = event.data.object as Stripe.Subscription;
          const userId = sub.metadata?.userId;
          const plan = (sub.metadata?.plan as SubscriptionPlan) ?? 'plus';
          if (userId) {
            await this.setPlan(tx, userId, plan, (sub.customer as string) ?? null);
            // current_period_end lives at the subscription level; read defensively
            // across Stripe API versions.
            const periodEndUnix = (sub as unknown as { current_period_end?: number }).current_period_end;
            await tx
              .update(schema.billingAccounts)
              .set({
                status: sub.status,
                ...(periodEndUnix ? { currentPeriodEnd: new Date(periodEndUnix * 1000) } : {}),
              })
              .where(eq(schema.billingAccounts.userId, userId));
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const userId = sub.metadata?.userId;
          if (userId) await this.setPlan(tx, userId, 'free', (sub.customer as string) ?? null);
          break;
        }
        default:
          this.logger.debug(`Unhandled Stripe event: ${event.type}`);
      }
      return { handled: true };
    });
  }

  /** RevenueCat mobile IAP webhook (shared-secret authenticated). */
  async handleRevenueCatEvent(body: {
    event?: { id?: string; type?: string; app_user_id?: string; entitlement_ids?: string[] };
  }): Promise<{ handled: boolean }> {
    const evt = body.event;
    if (!evt?.id || !evt.app_user_id) throw new AppError(ErrorCode.WebhookInvalid, 'Malformed event');
    const eventId = evt.id;
    const appUserId = evt.app_user_id;
    return this.database.asAdmin(async (tx) => {
      const seen = await tx
        .insert(schema.processedWebhookEvents)
        .values({ id: `rc_${eventId}`, provider: 'revenuecat' })
        .onConflictDoNothing()
        .returning({ id: schema.processedWebhookEvents.id });
      if (seen.length === 0) return { handled: false };

      const grantsPlan = evt.entitlement_ids?.includes('pro') ? 'pro' : 'plus';
      const plan: SubscriptionPlan =
        evt.type === 'CANCELLATION' || evt.type === 'EXPIRATION' ? 'free' : grantsPlan;
      await this.setPlan(tx, appUserId, plan, null);
      return { handled: true };
    });
  }

  private async ensureCustomer(userId: string, email: string): Promise<string> {
    const stripe = this.requireStripe();
    return this.database.asAdmin(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.billingAccounts)
        .where(eq(schema.billingAccounts.userId, userId))
        .limit(1);
      if (existing?.stripeCustomerId) return existing.stripeCustomerId;

      const customer = await stripe.customers.create({ email, metadata: { userId } });
      await tx
        .insert(schema.billingAccounts)
        .values({ userId, stripeCustomerId: customer.id })
        .onConflictDoUpdate({
          target: schema.billingAccounts.userId,
          set: { stripeCustomerId: customer.id },
        });
      return customer.id;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async setPlan(tx: any, userId: string, plan: SubscriptionPlan, customerId: string | null) {
    await tx
      .insert(schema.billingAccounts)
      .values({ userId, plan, ...(customerId ? { stripeCustomerId: customerId } : {}) })
      .onConflictDoUpdate({ target: schema.billingAccounts.userId, set: { plan } });
    await tx.insert(schema.auditLogs).values({
      actorId: userId,
      action: 'plan_change',
      entity: 'billing_account',
      entityId: userId,
      meta: { plan },
    });
  }
}
