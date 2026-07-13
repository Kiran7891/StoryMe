import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createCommentSchema, paginationSchema, reportSchema, repostSchema } from '@storyme/validation';
import type { CreateCommentInput, ReportInput, RepostInput } from '@storyme/validation';
import { type AuthUser, CurrentUser } from '../../common/decorators.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { SocialService } from './social.service.js';

@ApiTags('social')
@ApiBearerAuth()
@Controller()
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get('feed')
  feed(@CurrentUser() user: AuthUser, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const { limit: n } = paginationSchema.parse({ limit });
    return this.social.feed(user.id, 'following', n, cursor);
  }

  @Get('discover')
  discover(@CurrentUser() user: AuthUser, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const { limit: n } = paginationSchema.parse({ limit });
    return this.social.feed(user.id, 'discover', n, cursor);
  }

  @Get('reels')
  reels(@CurrentUser() user: AuthUser, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const { limit: n } = paginationSchema.parse({ limit });
    return this.social.feed(user.id, 'reels', n, cursor);
  }

  @Post('comics/:id/like')
  like(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.social.like(user.id, id);
  }

  @Delete('comics/:id/like')
  unlike(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.social.unlike(user.id, id);
  }

  @Get('comics/:id/comments')
  listComments(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ) {
    const { limit: n } = paginationSchema.parse({ limit });
    return this.social.listComments(user.id, id, n);
  }

  @Post('comics/:id/comments')
  addComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createCommentSchema)) body: CreateCommentInput,
  ) {
    return this.social.addComment(user.id, id, body.body, body.parentId);
  }

  @Delete('comments/:id')
  deleteComment(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.social.deleteComment(user.id, id);
  }

  @Post('comics/:id/repost')
  repost(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(repostSchema)) body: RepostInput,
  ) {
    return this.social.repost(user.id, id, body.caption);
  }

  @Post('comics/:id/view')
  view(@Param('id', ParseUUIDPipe) id: string) {
    return this.social.recordView(id);
  }

  @Post('comics/:id/report')
  reportComic(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reportSchema)) body: ReportInput,
  ) {
    return this.social.report(user.id, { comicId: id }, body.reason);
  }

  @Post('comments/:id/report')
  reportComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reportSchema)) body: ReportInput,
  ) {
    return this.social.report(user.id, { commentId: id }, body.reason);
  }

  @Post('users/:id/follow')
  follow(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.social.follow(user.id, id);
  }

  @Delete('users/:id/follow')
  unfollow(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.social.unfollow(user.id, id);
  }
}
