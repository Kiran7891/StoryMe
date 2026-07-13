import { Global, Module } from '@nestjs/common';
import { CreditsService } from './credits.service.js';

@Global()
@Module({ providers: [CreditsService], exports: [CreditsService] })
export class CreditsModule {}
