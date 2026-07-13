import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { IdempotencyInterceptor } from './common/idempotency.interceptor.js';
import { CreditsModule } from './modules/credits/credits.module.js';
import { InfraModule } from './infra/infra.module.js';
import { JwtAuthGuard } from './infra/jwt-auth.guard.js';
import { env } from './infra/env.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CharactersModule } from './modules/characters/characters.module.js';
import { ComicsModule } from './modules/comics/comics.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MeModule } from './modules/me/me.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PublicModule } from './modules/public/public.module.js';
import { SocialModule } from './modules/social/social.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';

@Module({
  imports: [
    // Structured JSON request logging with secret redaction.
    LoggerModule.forRoot({
      pinoHttp: {
        level: env().NODE_ENV === 'production' ? 'info' : 'debug',
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        autoLogging: { ignore: (req) => req.url?.includes('/health') === true },
      },
    }),
    // Global rate limiting: RATE_LIMIT_MAX requests/min per client; individual
    // routes tighten further with @Throttle (e.g. comic generation).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: env().RATE_LIMIT_MAX }]),
    InfraModule,
    CreditsModule,
    HealthModule,
    MeModule,
    CharactersModule,
    UploadsModule,
    ComicsModule,
    SocialModule,
    NotificationsModule,
    PublicModule,
    BillingModule,
    AdminModule,
  ],
  providers: [
    // Order matters: throttle → authenticate → (route guards) → idempotency.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
