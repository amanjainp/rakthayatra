import request from 'supertest';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/crypto';
import { mapsService } from '../src/services/maps.service';
import { firebaseService } from '../src/services/firebase.service';

const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockCount = jest.fn();

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
      findMany: (...args: any) => mockFindMany(...args),
      update: (...args: any) => mockUpdate(...args),
      count: (...args: any) => mockCount(...args),
    },
    medicalEligibility: {
      findFirst: (...args: any) => mockFindFirst(...args),
      findUnique: (...args: any) => mockFindUnique(...args),
      create: (...args: any) => mockCreate(...args),
      update: (...args: any) => mockUpdate(...args),
    },
    bloodBankProfile: {
      findFirst: (...args: any) => mockFindFirst(...args),
      findUnique: (...args: any) => mockFindUnique(...args),
    },
    bloodInventory: {
      findFirst: (...args: any) => mockFindFirst(...args),
      findUnique: (...args: any) => mockFindUnique(...args),
      findMany: (...args: any) => mockFindMany(...args),
      create: (...args: any) => mockCreate(...args),
      update: (...args: any) => mockUpdate(...args),
    },
    bloodRequest: {
      findFirst: (...args: any) => mockFindFirst(...args),
      findUnique: (...args: any) => mockFindUnique(...args),
      create: (...args: any) => mockCreate(...args),
      update: (...args: any) => mockUpdate(...args),
    },
    donation: {
      findFirst: (...args: any) => mockFindFirst(...args),
      findUnique: (...args: any) => mockFindUnique(...args),
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

describe('Rakthayatra Business Modules Integration Tests', () => {
  let adminToken: string;
  const mockDonorProfileId = 'a37b38d3-3561-460d-a3df-6a3f01c876e9';
  const mockBloodBankId = 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6';
  const mockDonationId = 'b86f1e16-7d6f-45a8-b648-289569faabdc';
  const mockRequestId = '1e2f3a4b-9c0d-7a8b-e5f6-a1b2c3d4e5f6';
  const mockInventoryId = 'c0a80101-3561-460d-a3df-6a3f01c876e9';

  beforeAll(() => {
    adminToken = generateAccessToken({
      userId: 'admin-usr-1',
      role: 'ADMIN',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockCreate.mockImplementation((args: any) => {
      if (args && typeof args === 'object' && 'data' in args) {
        return Promise.resolve({
          id: 'new-id',
          ...args.data,
        });
      }
      return Promise.resolve({ id: 'new-id', ...args });
    });

    mockUpdate.mockImplementation((args: any, secondArg?: any) => {
      if (args && typeof args === 'object' && 'where' in args && 'data' in args) {
        return Promise.resolve({
          id: args.where.id,
          ...args.data,
        });
      }
      return Promise.resolve({ id: args, ...secondArg });
    });
  });

  describe('Integration: Inventory ↔ Donation ↔ Eligibility Workflow', () => {
    it('should complete donation, update donor lastDonationDate, set medical eligibility deferral, and register blood stock in inventory', async () => {
      // 1. Setup mocks for donation completion
      mockFindFirst.mockImplementation((params: any) => {
        // Donation findById
        if (params?.where && params.where.id === mockDonationId) {
          return Promise.resolve({
            id: mockDonationId,
            donorProfileId: mockDonorProfileId,
            bloodBankId: mockBloodBankId,
            unitsDonated: 2,
            status: 'PENDING',
          });
        }
        // Donor profile lookup
        if (params?.where && params.where.id === mockDonorProfileId) {
          return Promise.resolve({
            id: mockDonorProfileId,
            bloodGroup: 'O_POS',
            userId: 'donor-usr-1',
          });
        }
        // Medical Eligibility lookup
        if (params?.where && params.where.donorProfileId === mockDonorProfileId) {
          return Promise.resolve({
            id: 'eligibility-1',
            donorProfileId: mockDonorProfileId,
          });
        }
        // Blood Bank Profile lookup
        if (params?.where && params.where.id === mockBloodBankId) {
          return Promise.resolve({
            id: mockBloodBankId,
          });
        }
        return Promise.resolve(null);
      });

      // Complete donation
      const response = await request(app)
        .post(`/api/donations/${mockDonationId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Healthy donation completed.' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.donation.status).toBe('COMPLETED');

      // Verify donor update was called
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: mockDonorProfileId },
        data: expect.objectContaining({
          lastDonationDate: expect.any(Date),
        }),
      }));

      // Verify medical eligibility update was called to defer the donor
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'eligibility-1' },
        data: expect.objectContaining({
          isEligible: false,
          nextEligibleDate: expect.any(Date),
        }),
      }));

      // Verify inventory was created for the blood bank
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          unitsCount: 2,
          bloodGroup: 'O_POS',
          status: 'AVAILABLE',
        }),
      }));
    });
  });

  describe('Integration: Blood Request ↔ Inventory Workflow', () => {
    it('should fulfill an approved blood request by automatically allocating matching available inventory units', async () => {
      // 1. Setup request, inventory matching queries
      mockFindFirst.mockImplementation((params: any) => {
        // Request lookup
        if (params?.where && params.where.id === mockRequestId) {
          return Promise.resolve({
            id: mockRequestId,
            bloodGroup: 'O_NEG',
            unitsRequired: 2,
            status: 'APPROVED',
          });
        }
        // Inventory lookup (matches first available O_NEG batch with >= 2 units count)
        if (params?.where && params.where.status === 'AVAILABLE' && params.where.unitsCount?.gte === 2) {
          return Promise.resolve({
            id: mockInventoryId,
            bloodBankId: mockBloodBankId,
            bloodGroup: 'O_NEG',
            unitsCount: 5,
            status: 'AVAILABLE',
            expiryDate: new Date(),
            updatedAt: new Date(),
          });
        }
        return Promise.resolve(null);
      });

      // Fulfill request
      const response = await request(app)
        .post(`/api/requests/${mockRequestId}/fulfill`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.request.status).toBe('FULFILLED');

      // Verify inventory was split/updated
      // 1. Deducted remaining units from available inventory
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: mockInventoryId },
        data: expect.objectContaining({
          unitsCount: 3, // 5 - 2
        }),
      }));

      // 2. Created new reserved record batch for the request
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          unitsCount: 2,
          status: 'RESERVED',
        }),
      }));
    });

    it('should throw BadRequestError if no compatible inventory is available to fulfill the request', async () => {
      mockFindFirst.mockImplementation((params: any) => {
        // Request lookup
        if (params?.where && params.where.id === mockRequestId) {
          return Promise.resolve({
            id: mockRequestId,
            bloodGroup: 'O_NEG',
            unitsRequired: 10,
            status: 'APPROVED',
          });
        }
        return Promise.resolve(null); // No compatible inventory matches
      });

      const response = await request(app)
        .post(`/api/requests/${mockRequestId}/fulfill`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('No compatible blood units available');
    });
  });

  describe('Integration: Request ↔ Donation Matching Alerts', () => {
    it('should match nearby eligible compatible donors and send push notification alerts when an EMERGENCY request is created', async () => {
      // Spy on maps and firebase services
      const distanceSpy = jest.spyOn(mapsService, 'calculateDistance').mockReturnValue(25.0); // 25km (within 50km boundary)
      const pushSpy = jest.spyOn(firebaseService, 'sendPushNotification').mockResolvedValue();

      mockFindFirst.mockResolvedValue({ id: 'user-requester' });

      // Return a compatible donor profile within bounding box
      mockFindMany.mockResolvedValue([
        {
          id: mockDonorProfileId,
          userId: 'donor-user-matched',
          latitude: 12.9716,
          longitude: 77.5946,
        },
      ]);

      mockCreate.mockResolvedValue({
        id: mockRequestId,
        bloodGroup: 'O_NEG',
        urgency: 'EMERGENCY',
        latitude: 12.95,
        longitude: 77.57,
      });

      const response = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bloodGroup: 'O_NEG',
          unitsRequired: 2,
          urgency: 'EMERGENCY',
          locationName: 'City General Hospital',
          latitude: 12.95,
          longitude: 77.57,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify that nearby donors matching and push alerts were scheduled
      expect(distanceSpy).toHaveBeenCalled();
      expect(pushSpy).toHaveBeenCalledWith(
        'donor-user-matched',
        expect.stringContaining('Urgent'),
        expect.stringContaining('emergency'),
        'EMERGENCY_ALERT'
      );

      distanceSpy.mockRestore();
      pushSpy.mockRestore();
    });
  });
});
