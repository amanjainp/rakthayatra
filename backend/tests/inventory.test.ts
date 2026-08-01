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
    bloodBankProfile: {
      findFirst: (...args: any) => mockFindFirst(...args),
    },
    bloodInventory: {
      findFirst: (...args: any) => mockFindFirst(...args),
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

describe('Inventory Module API Endpoint Tests', () => {
  let bankToken: string;
  let hospitalToken: string;
  let patientToken: string;

  beforeAll(() => {
    // Generate roles tokens matching TokenPayload types (userId and role)
    bankToken = generateAccessToken({
      userId: 'bank-usr-1',
      role: 'BLOOD_BANK',
    });
    hospitalToken = generateAccessToken({
      userId: 'hosp-usr-1',
      role: 'HOSPITAL',
    });
    patientToken = generateAccessToken({
      userId: 'pat-usr-1',
      role: 'PATIENT',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/inventory (Register Stock)', () => {
    it('should successfully register a blood unit batch for authorized BLOOD_BANK role', async () => {
      const mockBankId = 'e4de1674-c36b-4ec5-b1a9-3df721be049a';
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

      mockFindFirst.mockImplementation((params: any) => {
        // Mock finding the blood bank profile
        if (params.where && params.where.id === mockBankId) {
          return { id: mockBankId, name: 'City Central Blood Bank' };
        }
        return null;
      });

      mockCreate.mockResolvedValue({
        id: 'inv-12345',
        bloodBankId: mockBankId,
        bloodGroup: 'O_NEG',
        unitsCount: 10,
        expiryDate: futureDate,
        status: 'AVAILABLE',
      });

      const response = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${bankToken}`)
        .send({
          bloodBankId: mockBankId,
          bloodGroup: 'O_NEG',
          unitsCount: 10,
          expiryDate: futureDate,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.inventory.unitsCount).toBe(10);
    });

    it('should reject registration if units count is negative or zero', async () => {
      const response = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${bankToken}`)
        .send({
          bloodBankId: 'e4de1674-c36b-4ec5-b1a9-3df721be049a',
          bloodGroup: 'O_NEG',
          unitsCount: 0,
          expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should forbid stock registration for unauthorized roles (e.g. PATIENT)', async () => {
      const response = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          bloodBankId: 'e4de1674-c36b-4ec5-b1a9-3df721be049a',
          bloodGroup: 'O_NEG',
          unitsCount: 5,
          expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/inventory/reserve (Reserve Units)', () => {
    it('should split stock batch if reserving a fractional amount', async () => {
      const inventoryId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
      const mockUpdatedAt = new Date();

      mockFindFirst.mockResolvedValue({
        id: inventoryId,
        bloodBankId: 'bank-1',
        bloodGroup: 'A_POS',
        unitsCount: 15,
        expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: 'AVAILABLE',
        updatedAt: mockUpdatedAt,
      });

      mockCreate.mockResolvedValue({
        id: 'new-reserved-inv',
        bloodBankId: 'bank-1',
        bloodGroup: 'A_POS',
        unitsCount: 5,
        status: 'RESERVED',
      });

      const response = await request(app)
        .post('/api/inventory/reserve')
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({
          inventoryId,
          unitsToReserve: 5,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.inventory.status).toBe('RESERVED');
      expect(response.body.data.inventory.unitsCount).toBe(5);
    });

    it('should throw error if reserving more units than stock count', async () => {
      const inventoryId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

      mockFindFirst.mockResolvedValue({
        id: inventoryId,
        bloodBankId: 'bank-1',
        bloodGroup: 'A_POS',
        unitsCount: 15,
        status: 'AVAILABLE',
      });

      const response = await request(app)
        .post('/api/inventory/reserve')
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({
          inventoryId,
          unitsToReserve: 20,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('POST /api/inventory/release/:id (Release Units)', () => {
    it('should transition status back to AVAILABLE', async () => {
      const inventoryId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

      mockFindFirst.mockResolvedValue({
        id: inventoryId,
        bloodBankId: 'bank-1',
        unitsCount: 5,
        status: 'RESERVED',
      });

      mockUpdate.mockResolvedValue({
        id: inventoryId,
        unitsCount: 5,
        status: 'AVAILABLE',
      });

      const response = await request(app)
        .post(`/api/inventory/release/${inventoryId}`)
        .set('Authorization', `Bearer ${hospitalToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.inventory.status).toBe('AVAILABLE');
    });
  });

  describe('GET /api/inventory (Search stock)', () => {
    it('should fetch stock filtering by status and bloodGroup', async () => {
      mockFindMany.mockResolvedValue([
        { id: 'inv-1', bloodGroup: 'AB_POS', status: 'AVAILABLE', unitsCount: 12 },
      ]);
      mockCount.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${patientToken}`)
        .query({
          bloodGroup: 'AB_POS',
          status: 'AVAILABLE',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
    });
  });
});
