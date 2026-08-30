import request from 'supertest';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/crypto';

// Mock Prisma
const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockUpsert = jest.fn();
const mockDelete = jest.fn();

jest.mock('@prisma/client', () => {
  const actualPrisma = jest.requireActual('@prisma/client');
  const localMockPrisma: any = {
    user: {
      findUnique: (...args: any) => mockFindUnique(...args),
      findFirst: (...args: any) => mockFindFirst(...args),
      update: (...args: any) => mockUpdate(...args),
    },
    role: {
      findFirst: (...args: any) => mockFindFirst(...args),
    },
    donorProfile: {
      findUnique: (...args: any) => mockFindUnique(...args),
      findFirst: (...args: any) => mockFindFirst(...args),
      findMany: (...args: any) => mockFindMany(...args),
    },
    medicalEligibility: {
      findUnique: (...args: any) => mockFindUnique(...args),
      findFirst: (...args: any) => mockFindFirst(...args),
      upsert: (...args: any) => mockUpsert(...args),
    },
    bloodInventory: {
      findUnique: (...args: any) => mockFindUnique(...args),
      findFirst: (...args: any) => mockFindFirst(...args),
      findMany: (...args: any) => mockFindMany(...args),
      update: (...args: any) => mockUpdate(...args),
    },
    bloodRequest: {
      findUnique: (...args: any) => mockFindUnique(...args),
      findFirst: (...args: any) => mockFindFirst(...args),
      update: (...args: any) => mockUpdate(...args),
    },
    donation: {
      findUnique: (...args: any) => mockFindUnique(...args),
      findFirst: (...args: any) => mockFindFirst(...args),
      update: (...args: any) => mockUpdate(...args),
    },
    refreshToken: {
      findUnique: (...args: any) => mockFindUnique(...args),
      delete: (...args: any) => mockDelete(...args),
    },
    auditLog: {
      create: (...args: any) => mockCreate(...args),
    },
  };

  localMockPrisma.$transaction = jest.fn((callback: (tx: any) => any) => callback(localMockPrisma));

  return {
    ...actualPrisma,
    PrismaClient: jest.fn().mockImplementation(() => localMockPrisma),
  };
});

describe('LifeLink Production Readiness & Security Enforcement Tests', () => {
  let donorToken: string;
  let anotherDonorToken: string;
  let adminToken: string;
  const mockDonorId = 'd1d2d3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  const mockAnotherDonorId = 'd9d9d9d9-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

  beforeAll(() => {
    donorToken = generateAccessToken({ userId: 'donor-usr-1', role: 'DONOR' });
    anotherDonorToken = generateAccessToken({ userId: 'donor-usr-2', role: 'DONOR' });
    adminToken = generateAccessToken({ userId: 'admin-usr-1', role: 'ADMIN' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('OTP Brute Force & Rate Limit Protection', () => {
    it('should lock out OTP verification after 5 failed attempts', async () => {
      // Simulate attempts key already having 5 fails inside the cache
      const cache = require('../src/services/cache.service').cacheService;
      jest.spyOn(cache, 'get').mockImplementation(async (...args: any[]) => {
        const key = args[0] as string;
        if (key && key.includes('attempts')) {
          return '5'; // Simulated 5 attempts
        }
        return '123456';
      });

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'donor@lifelink.org', otp: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Too many invalid OTP attempts');
    });
  });

  describe('Session Invalidation on Suspended/Deleted Users', () => {
    it('should refuse to refresh tokens if user is soft-deleted or suspended', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'token-rec-1',
        token: 'refresh-token-val',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        user: {
          id: 'user-1',
          deletedAt: new Date(), // User is soft-deleted
          status: 'ACTIVE',
          role: { name: 'DONOR' },
        },
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['refreshToken=refresh-token-val'])
        .send();

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('deleted');
    });
  });

  describe('IDOR & Data Access Separation Controls', () => {
    it('should refuse to let a donor read another donor\'s stats or history', async () => {
      mockFindFirst.mockResolvedValue({
        id: mockDonorId,
        userId: 'donor-usr-1', // Belongs to donor-usr-1
      });

      const response = await request(app)
        .get(`/api/donations/donor/${mockDonorId}/stats`)
        .set('Authorization', `Bearer ${anotherDonorToken}`); // Requested by donor-usr-2

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('permission');
    });

    it('should refuse to let a donor read another donor\'s medical eligibility status', async () => {
      mockFindUnique.mockResolvedValue({
        id: mockAnotherDonorId,
        userId: 'donor-usr-2',
      });

      const response = await request(app)
        .get(`/api/eligibility/donor/${mockAnotherDonorId}`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('permission');
    });
  });

  describe('Intelligent Matchmaking / Radius Expansion Routing', () => {
    it('should return compatible matchmaking candidates for an approved request', async () => {
      const mockRequestId = '1e2f3a4b-9c0d-7a8b-e5f6-a1b2c3d4e5f6';

      mockFindUnique.mockResolvedValue({
        id: mockRequestId,
        bloodGroup: 'O_NEG',
        latitude: 12.9716,
        longitude: 77.5946,
        unitsRequired: 2,
        status: 'APPROVED',
      });

      // Mock finding nearby compatible blood banks and donors within bounding box
      mockFindMany.mockImplementation((params: any) => {
        // Return 1 blood bank with available O_NEG units
        if (params?.where?.status === 'AVAILABLE') {
          return Promise.resolve([
            {
              id: 'bank-1',
              bloodGroup: 'O_NEG',
              unitsCount: 10,
              bloodBank: {
                id: 'bank-profile-1',
                name: 'Metro Blood Bank',
                latitude: 12.9716,
                longitude: 77.5946,
              },
            },
          ]);
        }
        // Return 1 eligible active donor profile
        return Promise.resolve([
          {
            id: mockDonorId,
            fullName: 'Aman Jain',
            bloodGroup: 'O_NEG',
            latitude: 12.9816,
            longitude: 77.6046,
            isAvailable: true,
            deletedAt: null,
            requestsNotifiedCount: 4,
            requestsAcceptedCount: 2,
            lastDonationDate: null,
            user: { status: 'ACTIVE', deletedAt: null },
            eligibility: { isEligible: true, nextEligibleDate: null },
          },
        ]);
      });

      const response = await request(app)
        .get(`/api/requests/${mockRequestId}/matches`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.bloodBanks.length).toBe(1);
      expect(response.body.data.donors.length).toBe(1);
      expect(response.body.data.donors[0].name).toBe('Aman Jain');
      expect(response.body.data.donors[0].score).toBeGreaterThan(0);
    });
  });

  describe('Reservation Sweeps & Cleanups', () => {
    it('should trigger reservation sweep successfully for admin role', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 'inv-1',
          bloodBankId: 'bank-1',
          unitsCount: 5,
          status: 'RESERVED',
        },
      ]);
      mockUpdate.mockResolvedValue({});

      const response = await request(app)
        .post('/api/inventory/reservations-sweep')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.releasedReservationsCount).toBe(1);
    });
  });
});
