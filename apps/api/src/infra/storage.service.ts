import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { env } from './env.js';

/**
 * S3-compatible object storage (Cloudflare R2 by default). Clients upload directly
 * via short-lived presigned PUT URLs; the API never proxies file bytes.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor() {
    const e = env();
    this.bucket = e.STORAGE_BUCKET;
    this.publicBase = e.STORAGE_PUBLIC_BASE_URL;
    this.client = new S3Client({
      region: 'auto',
      endpoint: e.STORAGE_ENDPOINT,
      credentials: {
        accessKeyId: e.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: e.STORAGE_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  async presignPut(key: string, contentType: string, expiresSeconds = 300): Promise<string> {
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresSeconds });
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  publicUrl(key: string): string {
    return `${this.publicBase.replace(/\/$/, '')}/${key}`;
  }
}
