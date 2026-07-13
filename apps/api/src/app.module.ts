import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { CreditsModule } from './modules/credits/credits.module.js';
import { InfraModule } from './infra/infra.module.js';
import { JwtAuthGuard } from './infra/jwt-auth.guard.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CharactersModule } from './modules/characters/characters.module.js';
import { ComicsModule } from './modules/comics/comics.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MeModule } from './modules/me/me.module.js';
import { PublicModule } from './modules/public/public.module.js';
import { SocialModule } from './modules/social/social.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';

@Module({
  imports: [
    InfraModule,
    CreditsModule,
    HealthModule,
    MeModule,
    CharactersModule,
    UploadsModule,
    ComicsModule,
    SocialModule,
    PublicModule,
    BillingModule,
    AdminModule,
  ],
  providers: [
    // Global JWT auth guard (routes opt out with @Public()).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
