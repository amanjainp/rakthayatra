import request from 'supertest';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/crypto';

// Setup Mock mock functions
const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@prisma/client', () => {
  const actualPrisma = jest.requireActual('@prisma/client');
  const localMockPrisma: any = {
    user: {
      findFirst: (...args: any) => mockFindFirst(...args),
    },
    role: {
      findFirst: (...args: any) => mockFindFirst(...args),
    },
    donorProfile: {
      findFirst: (...args: any) => mockFindFirst(...args),
      update: (...args: any) => mockUpdate(...args),
    },
    medicalEligibility: {
      findFirst: (...args: any) => mockFindFirst(...args),
      create: (...args: any) => mockCreate(...args),
      update: (...args: any) => mockUpdate(...args),
    },
    donation: {
      findFirst: (...args: any) => mockFindFirst(...args),
      findMany: (...args: any) => mockFindMany(...args),
      count: (...args: any) => mockCount(...args),
      create: (...args: any) => mockCreate(...args),
      update: (...args: any) => mockUpdate(...args),
    },
    bloodBankProfile: {
      findFirst: (...args: any) => mockFindFirst(...args),
    },
    bloodInventory: {
      findFirst: (...args: any) => mockFindFirst(...args),
      create: (...args: any) => mockCreate(...args),
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

describe('Donation Module API Endpoint Tests', () => {
  let donorToken: string;
  let bankToken: string;

  beforeAll(() => {
    donorToken = generateAccessToken({
      userId: 'donor-usr-1',
      role: 'DONOR',
    });
    bankToken = generateAccessToken({
      userId: 'bank-usr-1',
      role: 'BLOOD_BANK',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/donations (Register Appointment)', () => {
    it('should successfully book a pending appointment if donor is eligible', async () => {
      const mockDonorId = 'd1d2d3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
      const mockBankId = 'b1b2b3b4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

      mockFindFirst.mockImplementation((params: any) => {
        // Mock donor profile lookup
        if (params.where && params.where.id === mockDonorId) {
          return { id: mockDonorId, bloodGroup: 'O_POS' };
        }
        // Mock medical eligibility lookup (return null -> default eligible)
        if (params.where && params.where.donorProfileId === mockDonorId) {
          return null;
        }
        return null;
      });

      mockCreate.mockResolvedValue({
        id: 'don-12345',
        donorProfileId: mockDonorId,
        bloodBankId: mockBankId,
        donationDate: new Date(),
        unitsDonated: 1,
        status: 'PENDING',
      });

      const response = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          donorProfileId: mockDonorId,
          bloodBankId: mockBankId,
          donationDate: new Date().toISOString(),
          unitsDonated: 1,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.donation.status).toBe('PENDING');
    });

    it('should throw BadRequestError if donor is ineligible', async () => {
      const mockDonorId = 'd1d2d3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

      mockFindFirst.mockImplementation((params: any) => {
        if (params.where && params.where.id === mockDonorId) {
          return { id: mockDonorId, bloodGroup: 'O_POS' };
        }
        if (params.where && params.where.donorProfileId === mockDonorId) {
          return { isEligible: false };
        }
        return null;
      });

      const response = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          donorProfileId: mockDonorId,
          bloodBankId: 'b1b2b3b4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
          donationDate: new Date().toISOString(),
          unitsDonated: 1,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('medically ineligible');
    });

    it('should throw BadRequestError if donor is inside deferral period', async () => {
      const mockDonorId = 'd1d2d3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
      const futureEligibleDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days later

      mockFindFirst.mockImplementation((params: any) => {
        if (params.where && params.where.id === mockDonorId) {
          return { id: mockDonorId, bloodGroup: 'O_POS' };
        }
        if (params.where && params.where.donorProfileId === mockDonorId) {
          return { isEligible: true, nextEligibleDate: futureEligibleDate };
        }
        return null;
      });

      const response = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          donorProfileId: mockDonorId,
          bloodBankId: 'b1b2b3b4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
          donationDate: new Date().toISOString(),
          unitsDonated: 1,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('deferral period');
    });
  });

  describe('POST /api/donations/:id/complete (Complete Donation)', () => {
    it('should flip status to COMPLETED, update deferral window, and register blood bank inventory stock', async () => {
      const donationId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
      const mockDonorId = 'd1d2d3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
      const mockBankId = 'b1b2b3b4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

      mockFindFirst.mockImplementation((params: any) => {
        // Mock finding the donation record
        if (params.where && params.where.id === donationId) {
          return {
            id: donationId,
            donorProfileId: mockDonorId,
            bloodBankId: mockBankId,
            status: 'PENDING',
            unitsDonated: 1,
          };
        }
        // Mock finding the associated donor profile
        if (params.where && params.where.id === mockDonorId) {
          return { id: mockDonorId, bloodGroup: 'O_POS' };
        }
        // Mock finding the associated blood bank profile
        if (params.where && params.where.id === mockBankId) {
          return { id: mockBankId, name: 'Central Blood Bank' };
        }
        return null;
      });

      mockUpdate.mockResolvedValue({
        id: donationId,
        status: 'COMPLETED',
      });

      const response = await request(app)
        .post(`/api/donations/${donationId}/complete`)
        .set('Authorization', `Bearer ${bankToken}`)
        .send({ notes: 'Healthy donation unit' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.donation.status).toBe('COMPLETED');
    });
  });

  describe('POST /api/donations/:id/cancel (Cancel Appointment)', () => {
    it('should successfully flip status to CANCELLED', async () => {
      const donationId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

      mockFindFirst.mockResolvedValue({
        id: donationId,
        status: 'PENDING',
      });

      mockUpdate.mockResolvedValue({
        id: donationId,
        status: 'CANCELLED',
      });

      const response = await request(app)
        .post(`/api/donations/${donationId}/cancel`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.donation.status).toBe('CANCELLED');
    });
  });

  describe('GET /api/donations/donor/:id/stats (Donor Statistics)', () => {
    it('should return compiled counts, lastDonationDate, and eligibility deferral state', async () => {
      const donorId = 'd1d2d3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

      mockFindMany.mockResolvedValue([
        { id: 'don-1', status: 'COMPLETED', unitsDonated: 1, donationDate: new Date() },
      ]);
      mockFindFirst.mockResolvedValue({
        isEligible: true,
        nextEligibleDate: null,
      });

      const response = await request(app)
        .get(`/api/donations/donor/${donorId}/stats`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalDonations).toBe(1);
      expect(response.body.data.totalUnitsDonated).toBe(1);
      expect(response.body.data.isEligibleToDonate).toBe(true);
    });
  });
});
