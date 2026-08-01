import request from 'supertest';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/crypto';

// Setup Mock functions
const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@prisma/client', () => {
  const actualPrisma = jest.requireActual('@prisma/client');
  const localMockPrisma: any = {
    user: {
      findFirst: (...args: any) => mockFindFirst(...args),
      findUnique: (...args: any) => mockFindUnique(...args),
    },
    role: {
      findFirst: (...args: any) => mockFindFirst(...args),
    },
    donorProfile: {
      findFirst: (...args: any) => mockFindFirst(...args),
      findUnique: (...args: any) => mockFindUnique(...args),
      update: (...args: any) => mockUpdate(...args),
    },
    medicalEligibility: {
      findFirst: (...args: any) => mockFindFirst(...args),
      findUnique: (...args: any) => mockFindUnique(...args),
      create: (...args: any) => mockCreate(...args),
      update: (...args: any) => mockUpdate(...args),
    },
    auditLog: {
      create: (...args: any) => mockCreate(...args),
      findMany: (...args: any) => mockFindMany(...args),
    },
  };

  localMockPrisma.$transaction = jest.fn((callback: (tx: any) => any) => callback(localMockPrisma));

  return {
    ...actualPrisma,
    PrismaClient: jest.fn().mockImplementation(() => localMockPrisma),
  };
});

describe('Medical Eligibility Module API Endpoint Tests', () => {
  let donorToken: string;
  const mockDonorId = 'd1d2d3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

  beforeAll(() => {
    donorToken = generateAccessToken({
      userId: 'donor-usr-1',
      role: 'DONOR',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/eligibility (Submit Questionnaire)', () => {
    it('should successfully evaluate donor as eligible if all answers are healthy', async () => {
      mockFindUnique.mockResolvedValue({
        id: mockDonorId,
        userId: 'donor-usr-1',
        lastDonationDate: null,
      });

      mockFindFirst.mockImplementation((params: any) => {
        // donorRepo.findById checks for id: mockDonorId
        if (params?.where && params.where.id === mockDonorId) {
          return Promise.resolve({
            id: mockDonorId,
            userId: 'donor-usr-1',
            lastDonationDate: null,
          });
        }
        // eligibilityRepo.findByDonorId checks for donorProfileId: mockDonorId
        return Promise.resolve(null);
      });

      mockCreate.mockResolvedValue({
        id: 'elig-12345',
        donorProfileId: mockDonorId,
        isEligible: true,
        nextEligibleDate: null,
      });

      const response = await request(app)
        .post('/api/eligibility')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          donorProfileId: mockDonorId,
          weight: 65,
          hasInfections: false,
          recentTattooOrPiercing: false,
          recentSurgery: false,
          isPregnantOrBreastfeeding: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligibility.isEligible).toBe(true);
    });

    it('should set isEligible to false and nextEligibleDate to 180 days later if recentTattooOrPiercing is true', async () => {
      mockFindUnique.mockResolvedValue({
        id: mockDonorId,
        userId: 'donor-usr-1',
        lastDonationDate: null,
      });

      mockFindFirst.mockImplementation((params: any) => {
        if (params?.where && params.where.id === mockDonorId) {
          return Promise.resolve({
            id: mockDonorId,
            userId: 'donor-usr-1',
            lastDonationDate: null,
          });
        }
        return Promise.resolve(null);
      });

      mockCreate.mockImplementation((args: any) => {
        return Promise.resolve({
          id: 'elig-12345',
          donorProfileId: mockDonorId,
          isEligible: args.data.isEligible,
          nextEligibleDate: args.data.nextEligibleDate,
        });
      });

      const response = await request(app)
        .post('/api/eligibility')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          donorProfileId: mockDonorId,
          weight: 70,
          hasInfections: false,
          recentTattooOrPiercing: true, // 180 days deferral
          recentSurgery: false,
          isPregnantOrBreastfeeding: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligibility.isEligible).toBe(false);

      const nextEligible = new Date(response.body.data.eligibility.nextEligibleDate);
      const diffDays = (nextEligible.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(178);
      expect(diffDays).toBeLessThan(182);
    });

    it('should set nextEligibleDate based on the 90-day interval if lastDonationDate was recent', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      mockFindUnique.mockResolvedValue({
        id: mockDonorId,
        userId: 'donor-usr-1',
        lastDonationDate: tenDaysAgo,
      });

      mockFindFirst.mockImplementation((params: any) => {
        if (params?.where && params.where.id === mockDonorId) {
          return Promise.resolve({
            id: mockDonorId,
            userId: 'donor-usr-1',
            lastDonationDate: tenDaysAgo,
          });
        }
        return Promise.resolve(null);
      });

      mockCreate.mockImplementation((args: any) => {
        return Promise.resolve({
          id: 'elig-12345',
          donorProfileId: mockDonorId,
          isEligible: args.data.isEligible,
          nextEligibleDate: args.data.nextEligibleDate,
        });
      });

      const response = await request(app)
        .post('/api/eligibility')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          donorProfileId: mockDonorId,
          weight: 75,
          hasInfections: false,
          recentTattooOrPiercing: false,
          recentSurgery: false,
          isPregnantOrBreastfeeding: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligibility.isEligible).toBe(false);

      const nextEligible = new Date(response.body.data.eligibility.nextEligibleDate);
      const diffDays = (nextEligible.getTime() - tenDaysAgo.getTime()) / (1000 * 60 * 60 * 24);
      expect(Math.round(diffDays)).toBe(90);
    });

    it('should throw ForbiddenError if a donor self-submits for another donor profile', async () => {
      mockFindUnique.mockResolvedValue({
        id: mockDonorId,
        userId: 'donor-usr-999', // Matches another user ID!
      });

      const response = await request(app)
        .post('/api/eligibility')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          donorProfileId: mockDonorId,
          weight: 65,
          hasInfections: false,
          recentTattooOrPiercing: false,
          recentSurgery: false,
          isPregnantOrBreastfeeding: false,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('do not have permission');
    });
  });

  describe('GET /api/eligibility/donor/:id (Get Current Status)', () => {
    it('should retrieve status successfully', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'elig-12345',
        donorProfileId: mockDonorId,
        isEligible: true,
        nextEligibleDate: null,
      });

      const response = await request(app)
        .get(`/api/eligibility/donor/${mockDonorId}`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligibility.isEligible).toBe(true);
    });
  });
});
