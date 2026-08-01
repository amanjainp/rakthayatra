import request from 'supertest';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/crypto';

// Setup Mock mock functions
const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
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
      findMany: (...args: any) => mockFindMany(...args),
    },
    bloodRequest: {
      findFirst: (...args: any) => mockFindFirst(...args),
      findUnique: (...args: any) => mockFindUnique(...args),
      findMany: (...args: any) => mockFindMany(...args),
      count: (...args: any) => mockCount(...args),
      create: (...args: any) => mockCreate(...args),
      update: (...args: any) => mockUpdate(...args),
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

describe('Blood Request Module API Endpoint Tests', () => {
  let patientToken: string;
  let adminToken: string;
  let anotherUserToken: string;

  beforeAll(() => {
    patientToken = generateAccessToken({
      userId: 'patient-usr-1',
      role: 'PATIENT',
    });
    adminToken = generateAccessToken({
      userId: 'admin-usr-1',
      role: 'ADMIN',
    });
    anotherUserToken = generateAccessToken({
      userId: 'patient-usr-2',
      role: 'PATIENT',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  describe('POST /api/requests (Create Request)', () => {
    it('should successfully submit an emergency blood request with 24-hour expiry', async () => {
      mockFindFirst.mockResolvedValue({ id: 'patient-usr-1' });

      mockCreate.mockImplementation((args: any) => {
        return Promise.resolve({
          id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
          requesterId: 'patient-usr-1',
          bloodGroup: args.data.bloodGroup,
          unitsRequired: args.data.unitsRequired,
          urgency: args.data.urgency,
          locationName: args.data.locationName,
          latitude: args.data.latitude,
          longitude: args.data.longitude,
          status: 'PENDING',
          expiresAt: args.data.expiresAt,
        });
      });

      const response = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          bloodGroup: 'O_NEG',
          unitsRequired: 3,
          urgency: 'EMERGENCY',
          locationName: 'City General Hospital',
          latitude: 28.6139,
          longitude: 77.209,
          message: 'Urgent cardiac surgery',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.request.urgency).toBe('EMERGENCY');
      expect(response.body.data.request.status).toBe('PENDING');

      // Verify expiresAt is approx 24h from now
      const expiresAt = new Date(response.body.data.request.expiresAt);
      const diffHours = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(23);
      expect(diffHours).toBeLessThan(25);
    });

    it('should reject requests with invalid coordinate parameters', async () => {
      const response = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          bloodGroup: 'O_NEG',
          unitsRequired: 3,
          urgency: 'EMERGENCY',
          locationName: 'City General Hospital',
          latitude: 100, // Invalid lat (>90)
          longitude: 77.209,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/requests/:id/approve (Approve Request)', () => {
    it('should transition status from PENDING to APPROVED for authorized Admin', async () => {
      const requestId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

      mockFindFirst.mockResolvedValue({
        id: requestId,
        status: 'PENDING',
      });

      mockUpdate.mockResolvedValue({
        id: requestId,
        status: 'APPROVED',
      });

      const response = await request(app)
        .post(`/api/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.request.status).toBe('APPROVED');
    });
  });

  describe('POST /api/requests/:id/cancel (Cancel Request)', () => {
    it('should allow owner to cancel pending request', async () => {
      const requestId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

      mockFindUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'patient-usr-1',
        status: 'PENDING',
      });

      mockFindFirst.mockResolvedValue({
        id: requestId,
        requesterId: 'patient-usr-1',
        status: 'PENDING',
      });

      mockUpdate.mockResolvedValue({
        id: requestId,
        status: 'CANCELLED',
      });

      const response = await request(app)
        .post(`/api/requests/${requestId}/cancel`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.request.status).toBe('CANCELLED');
    });

    it('should throw ForbiddenError if non-owner cancels request', async () => {
      const requestId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

      mockFindUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'patient-usr-1',
        status: 'PENDING',
      });

      const response = await request(app)
        .post(`/api/requests/${requestId}/cancel`)
        .set('Authorization', `Bearer ${anotherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('do not have permission');
    });
  });

  describe('POST /api/requests/expiry-check (Expiry Sweep)', () => {
    it('should successfully sweep expired requests and transition them to CANCELLED', async () => {
      mockFindMany.mockResolvedValue([
        { id: 'req-expired-1', requesterId: 'patient-1', status: 'PENDING' },
      ]);

      mockUpdate.mockResolvedValue({
        id: 'req-expired-1',
        status: 'CANCELLED',
      });

      const response = await request(app)
        .post('/api/requests/expiry-check')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.expiredRequestsCount).toBe(1);
    });
  });
});
