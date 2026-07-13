import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { type ApiErrorBody, ErrorCode, REQUEST_ID_HEADER } from '@storyme/shared-types';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from './app-error.js';

/** Converts every thrown error into the shared ApiErrorBody envelope. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = (req.headers[REQUEST_ID_HEADER.toLowerCase()] as string) ?? 'unknown';

    let status = 500;
    let code: ErrorCode = ErrorCode.Internal;
    let message = 'Internal server error';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof AppError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ZodError) {
      status = 422;
      code = ErrorCode.ValidationFailed;
      message = 'Validation failed';
      details = { issues: exception.issues };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
      code = status === 404 ? ErrorCode.NotFound : status === 403 ? ErrorCode.Forbidden : ErrorCode.Internal;
    }

    if (status >= 500) {
      this.logger.error(
        { err: exception, requestId, path: req.url },
        exception instanceof Error ? exception.message : 'Unhandled error',
      );
    }

    const body: ApiErrorBody = { error: { code, message, details }, requestId };
    res.status(status).json(body);
  }
}
