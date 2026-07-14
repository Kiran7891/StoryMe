import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { schema } from '@storyme/database';
import { paginationSchema } from '@storyme/validation';
import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { type AuthUser, CurrentUser } from '../../common/decorators.js';
import { DatabaseService } from '../../infra/database.module.js';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const { limit: n } = paginationSchema.parse({ limit });
    return this.database.asUser(user.id, (tx) =>
      tx
        .select()
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, user.id),
            cursor ? lt(schema.notifications.createdAt, new Date(cursor)) : undefined,
          ),
        )
        .orderBy(desc(schema.notifications.createdAt))
        .limit(n),
    );
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.database.asUser(user.id, async (tx) => {
      await tx
        .update(schema.notifications)
        .set({ readAt: new Date() })
        .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, user.id)));
      return { status: 'read' as const };
    });
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.database.asUser(user.id, async (tx) => {
      await tx
        .update(schema.notifications)
        .set({ readAt: new Date() })
        .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));
      return { status: 'all_read' as const };
    });
  }
}
