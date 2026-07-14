import { Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ErrorCode } from '@storyme/shared-types';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error.js';
import { type AuthUser, CurrentUser, Public } from '../../common/decorators.js';
import { env } from '../../infra/env.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { BillingService } from './billing.service.js';

const checkoutSchema = z.object({ plan: z.enum(['plus', 'pro']) });

@ApiTags('billing')
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @ApiBearerAuth()
  @Post('billing/checkout')
  checkout(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(checkoutSchema)) body: z.infer<typeof checkoutSchema>,
  ) {
    return this.billing.createCheckout(user.id, user.email, body.plan);
  }

  @ApiBearerAuth()
  @Post('billing/portal')
  portal(@CurrentUser() user: AuthUser) {
    return this.billing.createPortal(user.id, user.email);
  }

  @ApiBearerAuth()
  @Get('billing/subscription')
  subscription(@CurrentUser() user: AuthUser) {
    return this.billing.getSubscription(user.id);
  }

  @Public()
  @Post('webhooks/stripe')
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) throw new AppError(ErrorCode.WebhookInvalid, 'Missing raw body');
    const event = this.billing.verifyStripeEvent(req.rawBody, signature);
    return this.billing.handleStripeEvent(event);
  }

  @Public()
  @Post('webhooks/revenuecat')
  async revenueCatWebhook(
    @Headers('authorization') auth: string,
    @Body() body: Record<string, unknown>,
  ) {
    const secret = env().REVENUECAT_WEBHOOK_SECRET;
    if (!secret || auth !== `Bearer ${secret}`) {
      throw new AppError(ErrorCode.Unauthorized, 'Invalid webhook auth');
    }
    return this.billing.handleRevenueCatEvent(body);
  }
}
