import request from 'supertest';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/crypto';

// Setup Mock functions
const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockAggregate = jest.fn();

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
      count: (...args: any) => mockCount(...args),
    },
    hospitalProfile: {
      findFirst: (...args: any) => mockFindFirst(...args),
      findUnique: (...args: any) => mockFindUnique(...args),
    },
    donationCamp: {
      findFirst: (...args: any) => mockFindFirst(...args),
      findUnique: (...args: any) => mockFindUnique(...args),
      findMany: (...args: any) => mockFindMany(...args),
      create: (...args: any) => mockCreate(...args),
      update: (...args: any) => mockUpdate(...args),
    },
    donation: {
      count: (...args: any) => mockCount(...args),
      aggregate: (...args: any) => mockAggregate(...args),
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

describe('Donation Camp Module API Endpoint Tests', () => {
  let bankToken: string;
  let donorToken: string;
  let hospitalToken: string;
  const mockCampId = 'b86f1e16-7d6f-45a8-b648-289569faabdc';

  beforeAll(() => {
    bankToken = generateAccessToken({
      userId: 'bank-usr-1',
      role: 'BLOOD_BANK',
    });
    donorToken = generateAccessToken({
      userId: 'donor-usr-1',
      role: 'DONOR',
    });
    hospitalToken = generateAccessToken({
      userId: 'hosp-usr-1',
      role: 'HOSPITAL',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/camps (Create Camp)', () => {
    it('should successfully register a new donation camp', async () => {
      mockCreate.mockResolvedValue({
        id: mockCampId,
        name: 'Annual Blood Drive',
        organizer: 'Red Cross',
        address: 'Downtown Park',
        city: 'Metropolis',
        latitude: 40.7128,
        longitude: -74.006,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        status: 'UPCOMING',
      });

      const response = await request(app)
        .post('/api/camps')
        .set('Authorization', `Bearer ${bankToken}`)
        .send({
          name: 'Annual Blood Drive',
          organizer: 'Red Cross',
          address: 'Downtown Park',
          city: 'Metropolis',
          latitude: 40.7128,
          longitude: -74.006,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.camp.name).toBe('Annual Blood Drive');
    });

    it('should throw validation error if start date is after end date', async () => {
      const response = await request(app)
        .post('/api/camps')
        .set('Authorization', `Bearer ${bankToken}`)
        .send({
          name: 'Annual Blood Drive',
          organizer: 'Red Cross',
          address: 'Downtown Park',
          city: 'Metropolis',
          latitude: 40.7128,
          longitude: -74.006,
          startDate: new Date(Date.now() + 86400000).toISOString(), // After end date
          endDate: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/camps/:id/volunteer (Register Volunteer)', () => {
    it('should register volunteer details inside Redis', async () => {
      mockFindFirst.mockResolvedValue({ id: mockCampId });

      const response = await request(app)
        .post(`/api/camps/${mockCampId}/volunteer`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          name: 'Alice Smith',
          email: 'alice@gmail.com',
          phone: '9876543210',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Volunteer registered successfully');
    });
  });

  describe('POST /api/camps/:id/register-donor (Register Donor)', () => {
    it('should successfully associate camp with donor profile in database', async () => {
      const mockDonorProfileId = 'a37b38d3-3561-460d-a3df-6a3f01c876e9';

      mockFindFirst.mockImplementation((params: any) => {
        // Camp lookup
        if (params?.where && params.where.id === mockCampId) {
          return Promise.resolve({ id: mockCampId, status: 'UPCOMING' });
        }
        // Donor profile lookup
        if (params?.where && params.where.id === mockDonorProfileId) {
          return Promise.resolve({ id: mockDonorProfileId, userId: 'donor-usr-1' });
        }
        return Promise.resolve(null);
      });

      mockFindUnique.mockResolvedValue({
        id: mockDonorProfileId,
        userId: 'donor-usr-1',
      });

      mockUpdate.mockResolvedValue({
        id: mockDonorProfileId,
        donationCampId: mockCampId,
      });

      const response = await request(app)
        .post(`/api/camps/${mockCampId}/register-donor`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          donorProfileId: mockDonorProfileId,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/camps/:id/associate-hospital (Associate Hospital)', () => {
    it('should register hospital association in Redis', async () => {
      const mockHospitalId = 'c0a80101-3561-460d-a3df-6a3f01c876e9';

      mockFindFirst.mockImplementation((params: any) => {
        // Camp lookup
        if (params?.where && params.where.id === mockCampId) {
          return Promise.resolve({ id: mockCampId });
        }
        // Hospital profile lookup
        if (params?.where && params.where.id === mockHospitalId) {
          return Promise.resolve({ id: mockHospitalId, userId: 'hosp-usr-1' });
        }
        return Promise.resolve(null);
      });

      mockFindUnique.mockResolvedValue({
        id: mockHospitalId,
        userId: 'hosp-usr-1',
      });

      const response = await request(app)
        .post(`/api/camps/${mockCampId}/associate-hospital`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({
          hospitalProfileId: mockHospitalId,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/camps/:id/stats (Camp Statistics)', () => {
    it('should return compiled registered donor, volunteer, hospital, and donation aggregate counts', async () => {
      mockFindFirst.mockResolvedValue({ id: mockCampId });

      // donor counts, donation counts, aggregate units count
      mockCount.mockResolvedValue(5);
      mockAggregate.mockResolvedValue({
        _sum: { unitsDonated: 12 },
      });

      const response = await request(app)
        .get(`/api/camps/${mockCampId}/stats`)
        .set('Authorization', `Bearer ${bankToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.registeredDonorsCount).toBe(5);
      expect(response.body.data.totalUnitsCollected).toBe(12);
    });
  });
});
