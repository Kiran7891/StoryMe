import { ErrorCode, ErrorHttpStatus } from '@storyme/shared-types';

/**
 * Domain error carrying a canonical ErrorCode. The global exception filter maps
 * this to the shared ApiErrorBody envelope with the right HTTP status.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ErrorHttpStatus[code];
    this.details = details;
  }

  static notFound(what = 'Resource'): AppError {
    return new AppError(ErrorCode.NotFound, `${what} not found`);
  }
  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(ErrorCode.Forbidden, message);
  }
  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(ErrorCode.Unauthorized, message);
  }
  static insufficientCredits(): AppError {
    return new AppError(ErrorCode.InsufficientCredits, 'Not enough credits for this action');
  }
  static conflict(message = 'Conflict'): AppError {
    return new AppError(ErrorCode.Conflict, message);
  }
}
