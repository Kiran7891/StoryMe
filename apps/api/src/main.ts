import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_VERSION, REQUEST_ID_HEADER } from '@storyme/shared-types';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { nanoid } from 'nanoid';
import { AppModule } from './app.module.js';
import { env } from './infra/env.js';

async function bootstrap(): Promise<void> {
  const config = env();
  // rawBody enables Stripe webhook signature verification against the exact payload.
  const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true });

  app.use(helmet());
  app.enableCors({
    origin: config.CORS_ORIGINS === '*' ? true : config.CORS_ORIGINS.split(','),
    credentials: true,
  });

  // Attach a request id to every request/response for tracing + error envelopes.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const id = (req.headers[REQUEST_ID_HEADER.toLowerCase()] as string) ?? nanoid();
    req.headers[REQUEST_ID_HEADER.toLowerCase()] = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  });

  app.setGlobalPrefix(API_VERSION);
  // Validation is handled per-route via ZodValidationPipe against shared Zod schemas.
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('StoryMe API')
    .setDescription('Backend API for StoryMe — personalized comic stories + social feed.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${API_VERSION}/docs`, app, document);

  await app.listen(config.PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`StoryMe API listening on :${config.PORT} (/${API_VERSION})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
