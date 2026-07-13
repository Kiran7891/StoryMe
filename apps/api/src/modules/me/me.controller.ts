import { Body, Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { registerDeviceSchema, updateProfileSchema } from '@storyme/validation';
import type { RegisterDeviceInput, UpdateProfileInput } from '@storyme/validation';
import { type AuthUser, CurrentUser } from '../../common/decorators.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { MeService } from './me.service.js';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  getMe(@CurrentUser() user: AuthUser) {
    return this.me.getProfile(user.id);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.me.updateProfile(user.id, body);
  }

  @Delete()
  requestDeletion(@CurrentUser() user: AuthUser) {
    return this.me.requestDeletion(user.id);
  }

  @Get('export')
  exportData(@CurrentUser() user: AuthUser) {
    return this.me.requestExport(user.id);
  }

  @Post('devices')
  registerDevice(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(registerDeviceSchema)) body: RegisterDeviceInput,
  ) {
    return this.me.registerDevice(user.id, body);
  }
}
