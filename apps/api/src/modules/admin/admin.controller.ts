import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@storyme/shared-types';
import { paginationSchema } from '@storyme/validation';
import { z } from 'zod';
import { type AuthUser, CurrentUser, Roles } from '../../common/decorators.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { RolesGuard } from '../../infra/roles.guard.js';
import { AdminService } from './admin.service.js';

const moderateSchema = z.object({ decision: z.enum(['approved', 'rejected']) });
const grantSchema = z.object({
  amount: z.number().int().positive().max(10000),
  reason: z.string().min(1).max(200),
});

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.Admin)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users(@Query('limit') limit?: string) {
    return this.admin.listUsers(paginationSchema.parse({ limit }).limit);
  }

  @Get('comics')
  moderationQueue(@Query('limit') limit?: string) {
    return this.admin.moderationQueue(paginationSchema.parse({ limit }).limit);
  }

  @Post('comics/:id/moderate')
  moderate(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(moderateSchema)) body: z.infer<typeof moderateSchema>,
  ) {
    return this.admin.moderateComic(admin.id, id, body.decision);
  }

  @Post('users/:id/credits')
  grant(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(grantSchema)) body: z.infer<typeof grantSchema>,
  ) {
    return this.admin.grantCredits(admin.id, id, body.amount, body.reason);
  }

  @Get('metrics')
  metrics() {
    return this.admin.metrics();
  }
}
