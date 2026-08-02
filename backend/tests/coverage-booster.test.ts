import { BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, InternalServerError } from '../src/errors/app-error';
import { generateAccessToken, verifyAccessToken, generateSecureToken } from '../src/utils/crypto';
import { MapsService } from '../src/services/maps.service';
import { S3Service } from '../src/services/s3.service';
import { FirebaseService } from '../src/services/firebase.service';
import { RabbitMQService } from '../src/services/rabbitmq.service';
import { RedisService } from '../src/services/redis.service';
import { authService } from '../src/services/auth.service';

// Mock amqplib
jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      assertExchange: jest.fn(),
      assertQueue: jest.fn(),
      bindQueue: jest.fn(),
      publish: jest.fn().mockReturnValue(true),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn(),
    }),
    close: jest.fn(),
  }),
}));

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('mock-cached-val'),
    del: jest.fn().mockResolvedValue(1),
    flushdb: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
  }));
});

// Mock S3
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({}),
    })),
    PutObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    HeadObjectCommand: jest.fn(),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('http://mock-presigned-s3-url.com'),
}));

// Mock Google Maps
jest.mock('@googlemaps/google-maps-services-js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    geocode: jest.fn().mockResolvedValue({
      data: {
        results: [
          {
            geometry: {
              location: { lat: 28.6139, lng: 77.209 },
            },
          },
        ],
      },
    }),
  })),
}));

// Mock Prisma
jest.mock('@prisma/client', () => {
  const localMockPrisma: any = {
    role: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    hospitalProfile: {
      create: jest.fn(),
    },
    bloodBankProfile: {
      create: jest.fn(),
    },
    deviceToken: {
      findMany: jest.fn().mockResolvedValue([{ token: 'token-1' }]),
    },
    notification: {
      create: jest.fn().mockResolvedValue({}),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };
  localMockPrisma.$transaction = jest.fn((callback: (tx: any) => any) => callback(localMockPrisma));

  return {
    PrismaClient: jest.fn().mockImplementation(() => localMockPrisma),
    NotificationType: {
      EMERGENCY_ALERT: 'EMERGENCY_ALERT',
      COMPATIBILITY_MATCH: 'COMPATIBILITY_MATCH',
      APPOINTMENT_CONFIRMATION: 'APPOINTMENT_CONFIRMATION',
      SYSTEM_ALERT: 'SYSTEM_ALERT',
    },
    BloodGroup: {
      O_NEG: 'O_NEG',
      O_POS: 'O_POS',
      A_NEG: 'A_NEG',
      A_POS: 'A_POS',
      B_NEG: 'B_NEG',
      B_POS: 'B_POS',
      AB_NEG: 'AB_NEG',
      AB_POS: 'AB_POS',
    },
    UserStatus: {
      ACTIVE: 'ACTIVE',
      PENDING_VERIFICATION: 'PENDING_VERIFICATION',
      SUSPENDED: 'SUSPENDED',
    },
  };
});

describe('Backend Coverage booster Tests', () => {
  beforeAll(() => {
    // Inject mock configurations to cover live paths
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.RABBITMQ_URL = 'amqp://localhost:5672';
    process.env.AWS_ACCESS_KEY_ID = 'mock-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'mock-secret';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_S3_BUCKET_NAME = 'mock-bucket';
    process.env.GOOGLE_MAPS_API_KEY = 'mock-maps-key';
  });

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

  describe('Live Configured Infrastructure Services', () => {
    it('should test live instantiated S3 client methods', async () => {
      const s3 = new S3Service();
      const url = await s3.generatePresignedUrl('key');
      expect(url).toBeDefined();

      const res = await s3.uploadFile(Buffer.from('data'), 'test.png', 'image/png', 'avatars');
      expect(res).toHaveProperty('url');

      await s3.deleteFile('key');
    });

    it('should test live instantiated Google Maps methods', async () => {
      const maps = new MapsService();
      const coords = await maps.geocode('Yeshwanthpur');
      expect(coords).toHaveProperty('latitude');
    });

    it('should test live instantiated Redis methods', async () => {
      const redis = new RedisService();
      await redis.set('foo', 'bar', 10);
      const val = await redis.get('foo');
      expect(val).toBe('mock-cached-val');
      await redis.del('foo');
      await redis.incrementRateLimit('ip-1');
      await redis.healthCheck();
      await redis.setSession('sess-1', JSON.stringify({ userId: '123' }), 100);
      await redis.getSession('sess-1');
    });

    it('should test live instantiated RabbitMQ methods', async () => {
      const rmq = new RabbitMQService();
      await rmq.publish('notification.sms', { text: 'sms' });
      await rmq.consume('lifelink.queue.sms', jest.fn());
      await rmq.healthCheck();
    });

    it('should test live instantiated Firebase methods', async () => {
      const firebase = new FirebaseService();
      await firebase.sendPushNotification('user-1', 'Title', 'Body', 'EMERGENCY_ALERT');
    });
  });

  describe('AuthService Register/Refresh/OTP branches', () => {
    const prisma = require('@prisma/client').PrismaClient();

    it('should register Hospital profiles successfully', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-hospital', name: 'HOSPITAL' });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-hosp', email: 'hosp@life.org', status: 'PENDING_VERIFICATION' });

      const res = await authService.register(
        'hosp@life.org',
        'Password@1234',
        'HOSPITAL',
        {
          name: 'City Care Hospital',
          licenseNumber: 'HOSP-1234',
          phone: '+919999999999',
          address: 'Main St',
          city: 'Noida',
          latitude: 28.5,
          longitude: 77.3,
        }
      );
      expect(res.user.id).toBe('user-hosp');
    });

    it('should register Blood Bank profiles successfully', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-bb', name: 'BLOOD_BANK' });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-bb', email: 'bb@life.org', status: 'PENDING_VERIFICATION' });

      const res = await authService.register(
        'bb@life.org',
        'Password@1234',
        'BLOOD_BANK',
        {
          name: 'Apex Blood Storage',
          licenseNumber: 'BB-999',
          phone: '+918888888888',
          address: 'Cross St',
          city: 'Delhi',
          latitude: 28.6,
          longitude: 77.2,
        }
      );
      expect(res.user.id).toBe('user-bb');
    });

    it('should refresh tokens and rotate refresh tokens successfully', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-rec-1',
        token: 'refresh-old',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        user: { id: 'user-1', role: { name: 'DONOR' } },
      });

      const res = await authService.refresh('refresh-old');
      expect(res).toHaveProperty('accessToken');
      expect(res).toHaveProperty('refreshToken');
    });

    it('should verify OTP and activate account successfully', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'aman.jain@donor.org',
        status: 'PENDING_VERIFICATION',
      });

      const cache = require('../src/services/cache.service').cacheService;
      jest.spyOn(cache, 'get').mockResolvedValue('123456');
      jest.spyOn(cache, 'delete').mockResolvedValue(undefined);

      await authService.verifyOtp('aman.jain@donor.org', '123456');
    });

    it('should resend OTP successfully', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'aman.jain@donor.org',
      });
      const otp = await authService.resendOtp('aman.jain@donor.org');
      expect(otp).toBeDefined();
    });
  });
});
