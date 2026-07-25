import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import logger from '../config/logger';
import { BadRequestError, InternalServerError } from '../errors/app-error';
import crypto from 'crypto';

export class S3Service {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private isMockMode = false;

  // Constants for validations
  private readonly ALLOWED_AVATAR_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly ALLOWED_DOC_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];
  private readonly MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
  private readonly MAX_DOC_SIZE = 10 * 1024 * 1024; // 10 MB

  constructor() {
    this.bucketName = env.AWS_S3_BUCKET || 'lifelink-storage-bucket';

    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_REGION) {
      logger.warn('AWS S3 credentials or bucket name not configured in env. S3Service is running in MOCK mode.');
      this.isMockMode = true;
    } else {
      this.s3Client = new S3Client({
        region: env.AWS_REGION,
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      });
      logger.info('AWS S3 Client successfully initialized.');
    }
  }

  public getMockMode(): boolean {
    return this.isMockMode;
  }

  /**
   * Uploads a file buffer to AWS S3.
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    contentType: string,
    folder: 'avatars' | 'licenses' | 'documents',
  ): Promise<{ key: string; url: string }> {
    // 1. Perform Validation Checks
    this.validateFile(fileBuffer.length, contentType, folder);

    // 2. Generate Unique File Name
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.]/g, '_');
    const key = `${folder}/${crypto.randomUUID()}-${sanitizedName}`;

    if (this.isMockMode) {
      logger.info(`[MOCK] Uploading file to S3: key=${key}, contentType=${contentType}, size=${fileBuffer.length} bytes`);
      return {
        key,
        url: `https://s3.mock-region.amazonaws.com/${this.bucketName}/${key}`,
      };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    try {
      // Execute upload command with 3-attempt exponential backoff retry logic
      await this.executeWithRetry(() => this.s3Client!.send(command));
      
      const url = `https://${this.bucketName}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
      logger.info(`S3 Upload Success: key=${key}`);
      return { key, url };
    } catch (error: any) {
      logger.error(`S3 Upload Failure for key ${key}: ${error.message}`);
      throw new InternalServerError('Failed to upload file to storage. S3 connection failed.');
    }
  }

  /**
   * Deletes a file key from AWS S3.
   */
  async deleteFile(key: string): Promise<void> {
    if (this.isMockMode) {
      logger.info(`[MOCK] Deleting file from S3: key=${key}`);
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.executeWithRetry(() => this.s3Client!.send(command));
      logger.info(`S3 File Deleted: key=${key}`);
    } catch (error: any) {
      logger.error(`S3 Deletion Failure for key ${key}: ${error.message}`);
      throw new InternalServerError('Failed to delete file from storage.');
    }
  }

  /**
   * Generates a pre-signed URL for temporary private object download access.
   */
  async generatePresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (this.isMockMode) {
      logger.info(`[MOCK] Generating Presigned URL for key=${key}`);
      return `https://s3.mock-region.amazonaws.com/${this.bucketName}/${key}?presigned=true&expires=${expiresInSeconds}`;
    }

    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      // Check if file exists in S3 before signing
      await this.s3Client!.send(command);
    } catch (error) {
      throw new BadRequestError('Requested file key does not exist in S3 storage.');
    }

    try {
      const url = await getSignedUrl(this.s3Client!, command, { expiresIn: expiresInSeconds });
      return url;
    } catch (error: any) {
      logger.error(`Presigned URL generation failed for key ${key}: ${error.message}`);
      throw new InternalServerError('Failed to generate secure URL access token.');
    }
  }

  /**
   * Validates file size and content MIME type based on folder classifications.
   */
  private validateFile(size: number, mimeType: string, folder: 'avatars' | 'licenses' | 'documents') {
    if (folder === 'avatars') {
      if (!this.ALLOWED_AVATAR_MIMES.includes(mimeType)) {
        throw new BadRequestError('Invalid file format. Avatars must be JPG, PNG, or WEBP images.');
      }
      if (size > this.MAX_AVATAR_SIZE) {
        throw new BadRequestError('File size exceeds limit. Maximum avatar image size is 5MB.');
      }
    } else {
      if (!this.ALLOWED_DOC_MIMES.includes(mimeType)) {
        throw new BadRequestError('Invalid file format. Documents must be PDF, JPG, or PNG.');
      }
      if (size > this.MAX_DOC_SIZE) {
        throw new BadRequestError('File size exceeds limit. Maximum document size is 10MB.');
      }
    }
  }

  /**
   * Exponential backoff retry execution helper.
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      logger.warn(`S3 command execution failed. Retrying in ${delay}ms... Attempts remaining: ${retries}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.executeWithRetry(fn, retries - 1, delay * 2);
    }
  }
}

export const s3Service = new S3Service();
