import { ErrorCode } from '@storyme/shared-types';
import { createComicSchema } from '@storyme/validation';
import { describe, expect, it } from 'vitest';
import { AppError } from './app-error.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('AppError', () => {
  it('maps error codes to the correct HTTP status', () => {
    expect(AppError.notFound().status).toBe(404);
    expect(AppError.forbidden().status).toBe(403);
    expect(AppError.insufficientCredits().status).toBe(402);
    expect(AppError.insufficientCredits().code).toBe(ErrorCode.InsufficientCredits);
  });
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(createComicSchema);

  it('passes valid input through and applies defaults', () => {
    const out = pipe.transform({
      characterId: '11111111-1111-1111-1111-111111111111',
      prompt: 'A hero saves the day',
      style: 'noir',
    });
    expect(out.panelCount).toBe(6);
  });

  it('throws an AppError with ValidationFailed on bad input', () => {
    expect(() => pipe.transform({ prompt: 'x', style: 'nope' })).toThrowError(AppError);
    try {
      pipe.transform({ prompt: 'x', style: 'nope' });
    } catch (err) {
      expect((err as AppError).code).toBe(ErrorCode.ValidationFailed);
    }
  });
});
