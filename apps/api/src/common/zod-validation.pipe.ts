import { type PipeTransform } from '@nestjs/common';
import { ErrorCode } from '@storyme/shared-types';
import type { ZodSchema } from 'zod';
import { AppError } from './app-error.js';

/**
 * Validates and narrows an incoming payload with a Zod schema.
 * Usage: `@Body(new ZodValidationPipe(createComicSchema)) body: CreateComicInput`
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppError(ErrorCode.ValidationFailed, 'Validation failed', {
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
