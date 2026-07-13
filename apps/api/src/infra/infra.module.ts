import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from './database.module.js';
import { QueueModule } from './queue.module.js';
import { StorageModule } from './storage.module.js';
import { TokenVerifier } from './token-verifier.js';

/** Cross-cutting infrastructure available to every feature module. */
@Global()
@Module({
  imports: [DatabaseModule, StorageModule, QueueModule],
  providers: [TokenVerifier],
  exports: [DatabaseModule, StorageModule, QueueModule, TokenVerifier],
})
export class InfraModule {}
