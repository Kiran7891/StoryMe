import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ServerEnv } from '@storyme/config';

/** Uploads generated assets to object storage. Injectable so the pipeline can be
 *  tested with an in-memory implementation. */
export interface StorageUploader {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
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
}
