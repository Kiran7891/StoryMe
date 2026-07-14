import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { ServerEnv } from '@storyme/config';

/** Uploads generated assets to object storage. Injectable so the pipeline can be
 *  tested with an in-memory implementation. */
export interface StorageUploader {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  /** Delete every object under a key prefix (used for GDPR account erasure). */
  removePrefix(prefix: string): Promise<number>;
}

/** Cloudflare R2 / S3-compatible uploader used in production. */
export class S3StorageUploader implements StorageUploader {
  private readonly client: S3Client;
  private readonly bucket: string;
  constructor(env: ServerEnv) {
    this.bucket = env.STORAGE_BUCKET;
    this.client = new S3Client({
      region: 'auto',
      endpoint: env.STORAGE_ENDPOINT,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  async put(key: string, data: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }),
    );
  }

  async removePrefix(prefix: string): Promise<number> {
    let deleted = 0;
    let token: string | undefined;
    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const keys = (listed.Contents ?? []).map((o) => ({ Key: o.Key! })).filter((k) => k.Key);
      if (keys.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys } }),
        );
        deleted += keys.length;
      }
      token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (token);
    return deleted;
  }
}

/**
 * Local-filesystem storage driver (STORAGE_DRIVER=local). Useful for self-hosted
 * deployments and full-stack local development where an S3/R2 endpoint isn't
 * available. Writes objects under a base directory served by a static file host.
 */
export class LocalDiskUploader implements StorageUploader {
  constructor(private readonly baseDir: string) {}

  private path(key: string): string {
    return join(this.baseDir, key);
  }

  async put(key: string, data: Uint8Array, _contentType: string): Promise<void> {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  async removePrefix(prefix: string): Promise<number> {
    await rm(this.path(prefix), { recursive: true, force: true });
    return 1;
  }
}

/** Select a storage uploader from the environment (S3/R2 by default). */
export function createUploader(env: ServerEnv): StorageUploader {
  if (process.env.STORAGE_DRIVER === 'local') {
    return new LocalDiskUploader(process.env.STORAGE_LOCAL_DIR ?? '/tmp/storyme-storage');
  }
  return new S3StorageUploader(env);
}
