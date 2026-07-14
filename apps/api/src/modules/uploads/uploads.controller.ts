import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createUploadSchema } from '@storyme/validation';
import type { CreateUploadInput } from '@storyme/validation';
import { type AuthUser, CurrentUser } from '../../common/decorators.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { UploadsService } from './uploads.service.js';

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createUploadSchema)) body: CreateUploadInput,
  ) {
    return this.uploads.createUpload(user.id, body);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.uploads.completeUpload(user.id, id);
  }
}
