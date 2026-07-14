import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { Public } from '../../common/decorators.js';
import { DatabaseService } from '../../infra/database.module.js';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  /** Liveness — process is up. */
  @Public()
  @Get('health')
  health(): { status: 'ok'; ts: string } {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  /** Readiness — dependencies (DB) reachable. */
  @Public()
  @Get('ready')
  async ready(): Promise<{ status: 'ready' | 'degraded'; db: boolean }> {
    try {
      await this.database.db.execute(sql`select 1`);
      return { status: 'ready', db: true };
    } catch {
      return { status: 'degraded', db: false };
    }
  }
}
