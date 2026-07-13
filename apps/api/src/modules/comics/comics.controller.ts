import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createComicSchema, paginationSchema, shareComicSchema } from '@storyme/validation';
import type { CreateComicInput, ShareComicInput } from '@storyme/validation';
import { type AuthUser, CurrentUser } from '../../common/decorators.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ComicsService } from './comics.service.js';

@ApiTags('comics')
@ApiBearerAuth()
@Controller('comics')
export class ComicsController {
  constructor(private readonly comics: ComicsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const { limit: parsedLimit } = paginationSchema.parse({ limit, cursor });
    return this.comics.list(user.id, parsedLimit, cursor);
  }

  // Generation is the AI-cost path: cap it well below the global limit.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createComicSchema)) body: CreateComicInput,
  ) {
    return this.comics.create(user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.comics.get(user.id, id);
  }

  @Get(':id/status')
  status(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.comics.status(user.id, id);
  }

  @Post(':id/share')
  share(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(shareComicSchema)) body: ShareComicInput,
  ) {
    return this.comics.setShare(user.id, id, body);
  }
}
