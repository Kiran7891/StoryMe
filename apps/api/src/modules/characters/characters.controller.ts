import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createCharacterSchema } from '@storyme/validation';
import type { CreateCharacterInput } from '@storyme/validation';
import { type AuthUser, CurrentUser } from '../../common/decorators.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CharactersService } from './characters.service.js';

@ApiTags('characters')
@ApiBearerAuth()
@Controller('characters')
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.characters.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.characters.get(user.id, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCharacterSchema)) body: CreateCharacterInput,
  ) {
    return this.characters.create(user.id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.characters.remove(user.id, id);
  }
}
