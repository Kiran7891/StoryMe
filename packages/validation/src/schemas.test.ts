import { describe, expect, it } from 'vitest';
import { createComicSchema, createCharacterSchema, createUploadSchema } from './schemas';

describe('createComicSchema', () => {
  it('accepts a valid comic request and applies the default panel count', () => {
    const parsed = createComicSchema.parse({
      characterId: '11111111-1111-1111-1111-111111111111',
      prompt: 'A brave astronaut explores a candy planet.',
      style: 'manga',
    });
    expect(parsed.panelCount).toBe(6);
  });

  it('rejects an unknown art style', () => {
    const result = createComicSchema.safeParse({
      characterId: '11111111-1111-1111-1111-111111111111',
      prompt: 'hello world',
      style: 'crayon',
    });
    expect(result.success).toBe(false);
  });

  it('rejects panel counts outside the allowed range', () => {
    const result = createComicSchema.safeParse({
      characterId: '11111111-1111-1111-1111-111111111111',
      prompt: 'hello world',
      style: 'noir',
      panelCount: 99,
    });
    expect(result.success).toBe(false);
  });
});

describe('createCharacterSchema', () => {
  it('requires explicit consent', () => {
    const result = createCharacterSchema.safeParse({
      name: 'Mia',
      kind: 'child',
      uploadIds: ['11111111-1111-1111-1111-111111111111'],
      consent: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('createUploadSchema', () => {
  it('rejects unsupported mime types', () => {
    const result = createUploadSchema.safeParse({ mimeType: 'application/pdf', sizeBytes: 100 });
    expect(result.success).toBe(false);
  });
});
