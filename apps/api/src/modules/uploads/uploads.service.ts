import { Injectable } from '@nestjs/common';
import { schema } from '@storyme/database';
import { ErrorCode } from '@storyme/shared-types';
import type { CreateUploadInput } from '@storyme/validation';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { AppError } from '../../common/app-error.js';
import { DatabaseService } from '../../infra/database.module.js';
import { StorageService } from '../../infra/storage.service.js';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

@Injectable()
export class UploadsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  /** Reserve an upload record and hand back a short-lived presigned PUT URL. */
  async createUpload(userId: string, input: CreateUploadInput) {
    const ext = EXT_BY_MIME[input.mimeType] ?? 'bin';
    const key = `users/${userId}/uploads/${nanoid()}.${ext}`;

    const record = await this.database.asUser(userId, async (tx) => {
      const [row] = await tx
        .insert(schema.uploads)
        .values({
          userId,
          storageKey: key,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          status: 'pending',
        })
        .returning();
      if (!row) throw new AppError(ErrorCode.Internal, 'Failed to create upload');
      return row;
    });

    const uploadUrl = await this.storage.presignPut(key, input.mimeType);
    return { uploadId: record.id, uploadUrl, storageKey: key, expiresInSeconds: 300 };
  }

  /** Finalize an upload after the client PUT succeeds; verifies the object exists. */
  async completeUpload(userId: string, uploadId: string) {
    return this.database.asUser(userId, async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.uploads)
        .where(and(eq(schema.uploads.id, uploadId), eq(schema.uploads.userId, userId)))
        .limit(1);
      if (!row) throw AppError.notFound('Upload');
      if (row.status === 'uploaded') return { status: 'uploaded' as const, uploadId };

      const exists = await this.storage.objectExists(row.storageKey);
      if (!exists) throw new AppError(ErrorCode.Conflict, 'Object not found in storage');

      await tx.update(schema.uploads).set({ status: 'uploaded' }).where(eq(schema.uploads.id, uploadId));
      return { status: 'uploaded' as const, uploadId };
    });
  }
}
