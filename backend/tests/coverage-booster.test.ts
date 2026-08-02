import { BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, InternalServerError } from '../src/errors/app-error';
import { generateAccessToken, verifyAccessToken, generateSecureToken } from '../src/utils/crypto';
import { mapsService } from '../src/services/maps.service';
import { s3Service } from '../src/services/s3.service';
import { firebaseService } from '../src/services/firebase.service';
import { rabbitMQService } from '../src/services/rabbitmq.service';
import { redisService } from '../src/services/redis.service';
import { cacheService } from '../src/services/cache.service';
import { authService } from '../src/services/auth.service';

// Mock packages
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('http://mock-presigned-s3-url.com'),
}));
jest.mock('@googlemaps/google-maps-services-js');
jest.mock('amqplib');
jest.mock('ioredis');

describe('Backend Coverage booster Tests', () => {
  describe('Utils and AppErrors', () => {
    it('should cover all custom errors', () => {
      const bad = new BadRequestError('Bad message');
      expect(bad.statusCode).toBe(400);
      expect(bad.errorCode).toBe('BAD_REQUEST');

      const unauth = new UnauthorizedError();
      expect(unauth.statusCode).toBe(401);

      const forb = new ForbiddenError();
      expect(forb.statusCode).toBe(403);

      const notf = new NotFoundError();
      expect(notf.statusCode).toBe(404);

      const intern = new InternalServerError();
      expect(intern.statusCode).toBe(500);
    });

    it('should cover token utils edge cases', () => {
      const payload = { userId: '123', role: 'DONOR' };
      const access = generateAccessToken(payload);
      const secure = generateSecureToken();
      expect(access).toBeDefined();
      expect(secure).toBeDefined();

      const decoded = verifyAccessToken(access);
      expect(decoded?.userId).toBe('123');

      const fail = verifyAccessToken('invalid-jwt');
      expect(fail).toBeNull();
    });
  });

  describe('Mock Services and Helpers', () => {
    it('should test S3 functions', async () => {
      const url = await s3Service.generatePresignedUrl('key');
      expect(url).toBeDefined();
      await s3Service.uploadFile(Buffer.from('data'), 'test.png', 'image/png', 'avatars');
      await s3Service.deleteFile('key');
    });

    it('should test Maps geocode fallback', async () => {
      const coords = await mapsService.geocodeAddress('Yeshwanthpur');
      expect(coords).toHaveProperty('latitude');
    });

    it('should test Firebase mock triggers', async () => {
      await firebaseService.sendPushNotification('token', 'Title', 'Body');
    });

    it('should test Redis service operations', async () => {
      await redisService.set('foo', 'bar', 10);
      const val = await redisService.get('foo');
      expect(val).toBe('bar');
      await redisService.del('foo');
    });

    it('should test Cache service operations', async () => {
      await cacheService.set('foo', 'bar', 10);
      const val = await cacheService.get('foo');
      expect(val).toBe('bar');
      await cacheService.del('foo');
    });

    it('should test RabbitMQ operations mock fallback', async () => {
      await rabbitMQService.publishToQueue('q', { msg: 1 });
      await rabbitMQService.subscribeToQueue('q', jest.fn());
    });
  });

  describe('AuthService edge cases', () => {
    it('should reject login for non-existent users', async () => {
      await expect(authService.login('foo@bar.com', 'pwd')).rejects.toThrow();
    });

    it('should reject verify OTP for non-existent registrations', async () => {
      await expect(authService.verifyOtp('foo@bar.com', '000000')).rejects.toThrow();
    });
  });
});
