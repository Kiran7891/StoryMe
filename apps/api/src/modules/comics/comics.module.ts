import { Module } from '@nestjs/common';
import { ComicsController } from './comics.controller.js';
import { ComicsService } from './comics.service.js';

@Module({ controllers: [ComicsController], providers: [ComicsService] })
export class ComicsModule {}
