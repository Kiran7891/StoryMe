import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { schema } from '@storyme/database';
import { and, eq } from 'drizzle-orm';
import { AppError } from '../../common/app-error.js';
import { Public } from '../../common/decorators.js';
import { DatabaseService } from '../../infra/database.module.js';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly database: DatabaseService) {}

  /** Publicly shared comic by slug. RLS ensures only approved public comics are visible. */
  @Public()
  @Get('comics/:slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.database.asPublic(async (tx) => {
      const [comic] = await tx
        .select({
          id: schema.comics.id,
          title: schema.comics.title,
          style: schema.comics.style,
          format: schema.comics.format,
          coverKey: schema.comics.coverKey,
          videoKey: schema.comics.videoKey,
          publishedAt: schema.comics.publishedAt,
        })
        .from(schema.comics)
        .where(and(eq(schema.comics.shareSlug, slug), eq(schema.comics.isPublic, true)))
        .limit(1);
      if (!comic) throw AppError.notFound('Comic');
      const panels = await tx
        .select({
          index: schema.panels.index,
          imageKey: schema.panels.imageKey,
          dialogue: schema.panels.dialogue,
        })
        .from(schema.panels)
        .where(eq(schema.panels.comicId, comic.id))
        .orderBy(schema.panels.index);
      return { ...comic, panels };
    });
  }
}
