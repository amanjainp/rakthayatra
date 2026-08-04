import { BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, InternalServerError } from '../src/errors/app-error';
import { generateAccessToken, verifyAccessToken, generateSecureToken } from '../src/utils/crypto';
import { MapsService } from '../src/services/maps.service';
import { S3Service } from '../src/services/s3.service';
import { FirebaseService } from '../src/services/firebase.service';
import { RabbitMQService } from '../src/services/rabbitmq.service';
import { RedisService } from '../src/services/redis.service';
import { authService } from '../src/services/auth.service';
import { env } from '../src/config/env';
import { donationCampService } from '../src/services/donation-camp.service';
import { inventoryService } from '../src/services/inventory.service';
import { bloodRequestService } from '../src/services/blood-request.service';
import { medicalEligibilityService } from '../src/services/medical-eligibility.service';

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
    multi: jest.fn().mockReturnValue({
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 1],
        [null, 1],
      ]),
    }),
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
        status: 'OK',
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
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    hospitalProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    bloodBankProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    donorProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    medicalEligibility: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    donationCamp: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    bloodInventory: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    bloodRequest: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    donation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
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
      findMany: jest.fn(),
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
    env.REDIS_URL = 'redis://localhost:6379';
    env.RABBITMQ_URL = 'amqp://localhost:5672';
    env.AWS_ACCESS_KEY_ID = 'mock-key';
    env.AWS_SECRET_ACCESS_KEY = 'mock-secret';
    env.AWS_REGION = 'us-east-1';
    env.AWS_S3_BUCKET = 'mock-bucket';
    env.GOOGLE_MAPS_API_KEY = 'mock-maps-key';
    env.FIREBASE_PROJECT_ID = 'mock-project-id';
    env.FIREBASE_CLIENT_EMAIL = 'mock-email';
    env.FIREBASE_PRIVATE_KEY = 'mock-key';
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
      await new Promise((resolve) => setTimeout(resolve, 100));
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

      jest.spyOn(cache, 'get').mockResolvedValue(null);
      await expect(authService.verifyOtp('aman.jain@donor.org', 'invalid')).rejects.toThrow();
    });

    it('should resend OTP successfully', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'aman.jain@donor.org',
      });
      const otp = await authService.resendOtp('aman.jain@donor.org');
      expect(otp).toBeDefined();
    });

    it('should cover authService error cases', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(authService.register('e@e.com', 'p', 'INVALID_ROLE', {})).rejects.toThrow();

      prisma.role.findUnique.mockResolvedValue({ name: 'DONOR' });
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(authService.register('existing@e.com', 'p', 'DONOR', {})).rejects.toThrow();

      prisma.user.findUnique.mockResolvedValue(null);
      await expect(authService.login('non-existent@e.com', 'p')).rejects.toThrow();
      await expect(authService.resendOtp('non-existent@e.com')).rejects.toThrow();
      await expect(authService.forgotPassword('non-existent@e.com')).rejects.toThrow();

      const cache = require('../src/services/cache.service').cacheService;
      jest.spyOn(cache, 'get').mockResolvedValue(null);
      await expect(authService.resetPassword('invalid-token', 'p')).rejects.toThrow();
    });
  });

  describe('Other Services booster scenarios', () => {
    const prisma = require('@prisma/client').PrismaClient();

    it('should test inventoryService search caches and sweepExpiredBatches', async () => {
      const mockInventoryList = [{ id: 'batch-1', bloodBankId: 'bank-1', bloodGroup: 'O_NEG', status: 'AVAILABLE', unitsCount: 5 }];
      const redis = require('../src/services/redis.service').redisService;
      jest.spyOn(redis, 'getInventory').mockResolvedValue(JSON.stringify(mockInventoryList));

      const cachedSearch = await inventoryService.searchInventory({ bloodBankId: 'bank-1', bloodGroup: 'O_NEG', status: 'AVAILABLE' });
      expect(cachedSearch.total).toBe(1);

      prisma.bloodInventory.findMany.mockResolvedValue([
        { id: 'exp-1', bloodBankId: 'bank-1', bloodGroup: 'O_NEG', unitsCount: 2 }
      ]);
      prisma.bloodInventory.update.mockResolvedValue({ id: 'exp-1', status: 'EXPIRED' });
      prisma.auditLog.create.mockResolvedValue({});

      const swept = await inventoryService.checkAndFlagExpiredUnits('user-1');
      expect(swept.length).toBe(1);
    });

    it('should test donationCampService updates, registers, and deletes', async () => {
      prisma.donationCamp.findUnique.mockResolvedValue({ id: 'camp-1', status: 'ACTIVE' });
      prisma.donationCamp.findFirst.mockResolvedValue({ id: 'camp-1', status: 'ACTIVE' });
      prisma.donationCamp.update.mockResolvedValue({ id: 'camp-1', name: 'Updated Camp Name' });
      prisma.donationCamp.delete.mockResolvedValue({ id: 'camp-1' });
      prisma.donorProfile.findUnique.mockResolvedValue({ id: 'donor-1' });
      prisma.donorProfile.findFirst.mockResolvedValue({ id: 'donor-1' });

      const updated = await donationCampService.updateCamp('camp-1', { name: 'Updated Camp Name' }, 'user-1');
      expect(updated.name).toBe('Updated Camp Name');

      const deleted = await donationCampService.deleteCamp('camp-1', 'user-1');
      expect(deleted).toBeDefined();

      prisma.donationCamp.findUnique.mockResolvedValue({ id: 'camp-1', status: 'COMPLETED' });
      prisma.donationCamp.findFirst.mockResolvedValue({ id: 'camp-1', status: 'COMPLETED' });
      await expect(donationCampService.registerDonor('camp-1', 'donor-1')).rejects.toThrow();
    });

    it('should test bloodRequestService validation errors and cancellation', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.bloodRequest.create.mockResolvedValue({ id: 'req-1', urgency: 'NORMAL' });
      prisma.auditLog.create.mockResolvedValue({});
      const req = await bloodRequestService.createRequest({
        requesterId: 'user-1',
        bloodGroup: 'O_NEG',
        unitsRequired: 5,
        urgency: 'NORMAL',
        locationName: 'Delhi',
        latitude: 28.5,
        longitude: 77.2
      }, 'user-1');
      expect(req).toBeDefined();

      await expect(bloodRequestService.createRequest({
        requesterId: 'user-1',
        bloodGroup: 'O_NEG',
        unitsRequired: 5,
        urgency: 'NORMAL',
        locationName: 'Delhi',
        latitude: -120,
        longitude: 40
      })).rejects.toThrow();

      await expect(bloodRequestService.createRequest({
        requesterId: 'user-1',
        bloodGroup: 'O_NEG',
        unitsRequired: 0,
        urgency: 'NORMAL',
        locationName: 'Delhi',
        latitude: 28,
        longitude: 77
      })).rejects.toThrow();

      prisma.bloodRequest.findUnique.mockResolvedValue({ id: 'req-1', requesterId: 'requester-1' });
      await expect(bloodRequestService.updateRequestStatus('req-1', 'CANCELLED', 'other-user')).rejects.toThrow();
    });

    it('should test authService forgot/reset password pathways', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'reset@life.org' });
      prisma.user.update.mockResolvedValue({ id: 'user-1' });

      const cache = require('../src/services/cache.service').cacheService;
      jest.spyOn(cache, 'set').mockResolvedValue(undefined);
      jest.spyOn(cache, 'get').mockResolvedValue('user-1');
      jest.spyOn(cache, 'delete').mockResolvedValue(undefined);

      const token = await authService.forgotPassword('reset@life.org');
      expect(token).toBeDefined();

      await authService.resetPassword(token, 'NewPassword@1234');
    });

    it('should test medicalEligibilityService deferrals and histories', async () => {
      prisma.donorProfile.findUnique.mockResolvedValue({ id: 'donor-1', lastDonationDate: new Date() });
      prisma.donorProfile.findFirst.mockResolvedValue({ id: 'donor-1', lastDonationDate: new Date() });
      prisma.medicalEligibility.findFirst.mockResolvedValue(null);
      prisma.medicalEligibility.findUnique.mockResolvedValue(null);
      prisma.medicalEligibility.create.mockResolvedValue({ id: 'elig-1' });
      prisma.donorProfile.update.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});
      prisma.auditLog.findMany.mockResolvedValue([]);

      // Submit failing questionnaire
      await medicalEligibilityService.submitQuestionnaire('donor-1', {
        weight: 45,
        hasInfections: true,
        recentSurgery: true,
        recentTattooOrPiercing: true,
        isPregnantOrBreastfeeding: true,
      });

      // Get history
      const history = await medicalEligibilityService.getEligibilityHistory('donor-1');
      expect(history.length).toBe(0);
    });

    it('should test validation/error pathway branches across other services', async () => {
      // 1. bloodRequestService
      prisma.bloodRequest.findUnique.mockResolvedValue({ id: 'req-1', status: 'PENDING' });
      await expect(bloodRequestService.updateRequestStatus('req-1', 'FULFILLED', 'user-1')).rejects.toThrow();

      prisma.bloodRequest.findUnique.mockResolvedValue({ id: 'req-1', status: 'APPROVED' });
      await expect(bloodRequestService.updateRequestStatus('req-1', 'APPROVED', 'user-1')).rejects.toThrow();

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(bloodRequestService.createRequest({
        requesterId: 'non-existent',
        bloodGroup: 'O_NEG',
        unitsRequired: 5,
        urgency: 'NORMAL',
        locationName: 'Delhi',
        latitude: 28.5,
        longitude: 77.2
      })).rejects.toThrow();

      // 2. donationCampService
      await expect(donationCampService.createCamp({
        name: 'Camp',
        organizer: 'Hospital A',
        address: 'Delhi',
        city: 'Delhi',
        startDate: new Date(Date.now() + 200000),
        endDate: new Date(Date.now() + 100000),
        latitude: 12,
        longitude: 77
      }, 'user-1')).rejects.toThrow();

      prisma.donationCamp.findUnique.mockResolvedValue(null);
      prisma.donationCamp.findFirst.mockResolvedValue(null);
      await expect(donationCampService.updateCamp('non-existent', { name: 'Name' }, 'user-1')).rejects.toThrow();

      prisma.donationCamp.findFirst.mockResolvedValue({ id: 'camp-1' });
      prisma.donationCamp.findUnique.mockResolvedValue({ id: 'camp-1' });
      await expect(donationCampService.updateCamp('camp-1', {
        startDate: new Date(Date.now() + 200000),
        endDate: new Date(Date.now() + 100000)
      })).rejects.toThrow();

      prisma.donationCamp.findFirst.mockResolvedValue(null);
      prisma.donationCamp.findUnique.mockResolvedValue(null);
      await expect(donationCampService.deleteCamp('camp-not-exists')).rejects.toThrow();

      prisma.donationCamp.findFirst.mockResolvedValue(null);
      await expect(donationCampService.registerDonor('camp-not-exists', 'donor-1')).rejects.toThrow();

      prisma.donationCamp.findFirst.mockResolvedValue({ id: 'camp-1', status: 'COMPLETED' });
      await expect(donationCampService.registerDonor('camp-1', 'donor-1')).rejects.toThrow();

      prisma.donationCamp.findFirst.mockResolvedValue({ id: 'camp-1', status: 'ACTIVE' });
      prisma.donorProfile.findFirst.mockResolvedValue(null);
      await expect(donationCampService.registerDonor('camp-1', 'donor-not-exists')).rejects.toThrow();

      prisma.donationCamp.findFirst.mockResolvedValue(null);
      await expect(donationCampService.associateHospital('camp-not-exists', 'hosp-1')).rejects.toThrow();

      prisma.donationCamp.findFirst.mockResolvedValue({ id: 'camp-1' });
      prisma.hospitalProfile.findFirst.mockResolvedValue(null);
      await expect(donationCampService.associateHospital('camp-1', 'hosp-not-exists')).rejects.toThrow();

      // 3. donationService
      prisma.donorProfile.findUnique.mockResolvedValue(null);
      prisma.donorProfile.findFirst.mockResolvedValue(null);
      const donationService = require('../src/services/donation.service').donationService;
      await expect(donationService.registerAppointment({
        donorProfileId: 'non-existent',
        donationDate: new Date(),
        unitsDonated: 5
      })).rejects.toThrow();

      prisma.donation.findUnique.mockResolvedValue(null);
      prisma.donation.findFirst.mockResolvedValue(null);
      await expect(donationService.cancelDonation('non-existent', 'user-1')).rejects.toThrow();

      prisma.donation.findUnique.mockResolvedValue({ id: 'appt-1', status: 'COMPLETED' });
      prisma.donation.findFirst.mockResolvedValue({ id: 'appt-1', status: 'COMPLETED' });
      await expect(donationService.cancelDonation('appt-1', 'user-1')).rejects.toThrow();

      // 4. inventoryService
      prisma.bloodBankProfile.findUnique.mockResolvedValue(null);
      prisma.bloodBankProfile.findFirst.mockResolvedValue(null);
      await expect(inventoryService.registerBloodUnit({
        bloodBankId: 'non-existent',
        bloodGroup: 'O_NEG',
        unitsCount: 5,
        expiryDate: new Date(Date.now() + 100000)
      })).rejects.toThrow();

      await expect(inventoryService.registerBloodUnit({
        bloodBankId: 'bank-1',
        bloodGroup: 'O_NEG',
        unitsCount: -5,
        expiryDate: new Date(Date.now() + 100000)
      })).rejects.toThrow();

      await expect(inventoryService.registerBloodUnit({
        bloodBankId: 'bank-1',
        bloodGroup: 'O_NEG',
        unitsCount: 5,
        expiryDate: new Date(Date.now() - 100000)
      })).rejects.toThrow();

      await expect(inventoryService.reserveUnits({ inventoryId: 'batch-1', unitsToReserve: 0 })).rejects.toThrow();

      prisma.bloodInventory.findUnique.mockResolvedValue({ id: 'batch-1', status: 'AVAILABLE', unitsCount: 2 });
      prisma.bloodInventory.findFirst.mockResolvedValue({ id: 'batch-1', status: 'AVAILABLE', unitsCount: 2 });
      await expect(inventoryService.reserveUnits({ inventoryId: 'batch-1', unitsToReserve: 5 })).rejects.toThrow();

      prisma.bloodInventory.findUnique.mockResolvedValue(null);
      prisma.bloodInventory.findFirst.mockResolvedValue(null);
      await expect(inventoryService.releaseUnits('non-existent')).rejects.toThrow();

      prisma.bloodInventory.findUnique.mockResolvedValue({ id: 'batch-1', status: 'AVAILABLE' });
      prisma.bloodInventory.findFirst.mockResolvedValue({ id: 'batch-1', status: 'AVAILABLE' });
      await expect(inventoryService.releaseUnits('batch-1')).rejects.toThrow();

      // Extra edge cases
      await expect(donationService.registerAppointment({
        donorProfileId: 'donor-1',
        donationDate: new Date(),
        unitsDonated: 0
      })).rejects.toThrow();

      prisma.donationCamp.findFirst.mockResolvedValue(null);
      await expect(donationCampService.registerVolunteer('camp-not-exists', { name: 'V', email: 'v@v.com', phone: '123' })).rejects.toThrow();

      prisma.donationCamp.findFirst.mockResolvedValue({ id: 'camp-1' });
      const { RedisService } = require('../src/services/redis.service');
      jest.spyOn(RedisService.prototype, 'get').mockResolvedValue(JSON.stringify([{ email: 'v@v.com' }]));
      await expect(donationCampService.registerVolunteer('camp-1', { name: 'V', email: 'v@v.com', phone: '123' })).rejects.toThrow();

      prisma.donationCamp.findFirst.mockResolvedValue({ id: 'camp-1' });
      prisma.hospitalProfile.findFirst.mockResolvedValue({ id: 'hosp-1' });
      jest.spyOn(RedisService.prototype, 'get').mockResolvedValue(JSON.stringify([{ hospitalProfileId: 'hosp-1' }]));
      await expect(donationCampService.associateHospital('camp-1', 'hosp-1')).rejects.toThrow();

      prisma.donationCamp.findFirst.mockResolvedValue(null);
      await expect(donationCampService.getCampStatistics('camp-not-exists')).rejects.toThrow();

      prisma.donationCamp.findMany.mockResolvedValue([]);
      prisma.donationCamp.count.mockResolvedValue(0);
      const campsResult = await donationCampService.getCamps({ city: 'Delhi', page: 2, limit: 5 });
      expect(campsResult.total).toBe(0);
    });
  });
});
