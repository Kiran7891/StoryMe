import { Injectable } from '@nestjs/common';
import { schema } from '@storyme/database';
import type { CreateCharacterInput } from '@storyme/validation';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { AppError } from '../../common/app-error.js';
import { DatabaseService } from '../../infra/database.module.js';

@Injectable()
export class CharactersService {
  constructor(private readonly database: DatabaseService) {}

  async list(userId: string) {
    return this.database.asUser(userId, (tx) =>
      tx
        .select()
        .from(schema.characters)
        .where(and(eq(schema.characters.userId, userId), isNull(schema.characters.deletedAt)))
        .orderBy(desc(schema.characters.createdAt)),
    );
  }

  async get(userId: string, id: string) {
    return this.database.asUser(userId, async (tx) => {
      const [character] = await tx
        .select()
        .from(schema.characters)
        .where(and(eq(schema.characters.id, id), isNull(schema.characters.deletedAt)))
        .limit(1);
      if (!character) throw AppError.notFound('Character');
      const photos = await tx
        .select()
        .from(schema.characterPhotos)
        .where(eq(schema.characterPhotos.characterId, id));
      return { ...character, photos };
    });
  }

  async create(userId: string, input: CreateCharacterInput) {
    return this.database.asUser(userId, async (tx) => {
      // Verify every referenced upload belongs to the user and is finalized.
      const uploads = await tx
        .select({ id: schema.uploads.id })
        .from(schema.uploads)
        .where(
          and(
            inArray(schema.uploads.id, input.uploadIds),
            eq(schema.uploads.userId, userId),
            eq(schema.uploads.status, 'uploaded'),
          ),
        );
      if (uploads.length !== input.uploadIds.length) {
        throw AppError.conflict('One or more uploads are missing or not finalized');
      }

      const [character] = await tx
        .insert(schema.characters)
        .values({ userId, name: input.name, kind: input.kind })
        .returning();
      if (!character) throw new AppError('internal_error', 'Failed to create character');

      await tx.insert(schema.characterPhotos).values(
        input.uploadIds.map((uploadId) => ({ characterId: character.id, uploadId })),
      );
      return character;
    });
  }

  async remove(userId: string, id: string) {
    await this.database.asUser(userId, (tx) =>
      tx
        .update(schema.characters)
        .set({ deletedAt: new Date() })
        .where(and(eq(schema.characters.id, id), eq(schema.characters.userId, userId))),
    );
    return { status: 'deleted' as const };
  }
}
