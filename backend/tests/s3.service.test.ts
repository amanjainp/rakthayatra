import { S3Service } from '../src/services/s3.service';
import { BadRequestError } from '../src/errors/app-error';

// Mock S3 SDK Client
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => {
      return {
        send: mockSend,
      };
    }),
    PutObjectCommand: jest.fn().mockImplementation((args) => args),
    DeleteObjectCommand: jest.fn().mockImplementation((args) => args),
    HeadObjectCommand: jest.fn().mockImplementation((args) => args),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => {
  return {
    getSignedUrl: jest.fn().mockResolvedValue('https://mock-s3-presigned-url.com'),
  };
});

describe('S3Service Infrastructure Layer Tests', () => {
  let s3ServiceInstance: S3Service;

  beforeEach(() => {
    jest.clearAllMocks();
    s3ServiceInstance = new S3Service();
  });

  describe('File Size and MIME Validation checks', () => {
    it('should allow valid avatars within the 5MB size limit', async () => {
      const buffer = Buffer.alloc(2 * 1024 * 1024); // 2 MB
      const result = await s3ServiceInstance.uploadFile(buffer, 'avatar.png', 'image/png', 'avatars');
      expect(result.key).toContain('avatars/');
    });

    it('should throw BadRequestError on excess avatar file size (>5MB)', async () => {
      const buffer = Buffer.alloc(6 * 1024 * 1024); // 6 MB
      await expect(
        s3ServiceInstance.uploadFile(buffer, 'large.jpg', 'image/jpeg', 'avatars'),
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError on invalid avatar MIME type', async () => {
      const buffer = Buffer.alloc(1 * 1024 * 1024); // 1 MB
      await expect(
        s3ServiceInstance.uploadFile(buffer, 'document.pdf', 'application/pdf', 'avatars'),
      ).rejects.toThrow(BadRequestError);
    });

    it('should allow valid hospital license documents within the 10MB limit', async () => {
      const buffer = Buffer.alloc(8 * 1024 * 1024); // 8 MB
      const result = await s3ServiceInstance.uploadFile(buffer, 'license.pdf', 'application/pdf', 'licenses');
      expect(result.key).toContain('licenses/');
    });

    it('should throw BadRequestError on invalid document extensions', async () => {
      const buffer = Buffer.alloc(1 * 1024 * 1024);
      await expect(
        s3ServiceInstance.uploadFile(buffer, 'unsafe.exe', 'application/x-msdownload', 'licenses'),
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('Unique File Naming Checks', () => {
    it('should append a random UUID and sanitize names', async () => {
      const buffer = Buffer.alloc(100);
      const name = 'test user avatar.png';
      const result = await s3ServiceInstance.uploadFile(buffer, name, 'image/png', 'avatars');
      expect(result.key).toMatch(/avatars\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-test_user_avatar.png/);
    });
  });

  describe('Retry Logics', () => {
    it('should retry failed S3 client sends with exponential backoff on error', async () => {
      // Force non-mock mode for testing retry logic
      (s3ServiceInstance as any).isMockMode = false;
      (s3ServiceInstance as any).s3Client = { send: mockSend };

      // Throw S3 network error twice, then succeed
      mockSend
        .mockRejectedValueOnce(new Error('S3 Connection Lost'))
        .mockRejectedValueOnce(new Error('S3 Connection Timeout'))
        .mockResolvedValueOnce({ $metadata: { httpStatusCode: 200 } });

      const buffer = Buffer.alloc(100);
      const result = await s3ServiceInstance.uploadFile(buffer, 'file.png', 'image/png', 'avatars');

      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(result.key).toBeDefined();
    });
  });
});
