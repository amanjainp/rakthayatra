import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../src/repositories/user.repository';
import { InventoryRepository } from '../src/repositories/inventory.repository';
import { PatientRepository } from '../src/repositories/patient.repository';
import { ConflictError } from '../src/errors/app-error';

// Mock Prisma client models
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

jest.mock('@prisma/client', () => {
  const actualPrisma = jest.requireActual('@prisma/client');
  const localMockPrisma = {
    user: {
      findMany: (...args: any) => mockFindMany(...args),
      count: (...args: any) => mockCount(...args),
      findFirst: (...args: any) => mockFindFirst(...args),
      create: (...args: any) => mockCreate(...args),
      update: (...args: any) => mockUpdate(...args),
      delete: (...args: any) => mockDelete(...args),
    },
    bloodInventory: {
      findFirst: (...args: any) => mockFindFirst(...args),
      update: (...args: any) => mockUpdate(...args),
    },
  };
  return {
    ...actualPrisma,
    PrismaClient: jest.fn().mockImplementation(() => localMockPrisma),
  };
});

const prisma = new PrismaClient() as any;

describe('Repository Layer Unit Tests', () => {
  let userRepo: UserRepository;
  let inventoryRepo: InventoryRepository;
  let patientRepo: PatientRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo = new UserRepository(prisma);
    inventoryRepo = new InventoryRepository(prisma);
    patientRepo = new PatientRepository(prisma);
  });

  describe('BaseRepository Pagination', () => {
    it('should correctly format limit and offset bounds', async () => {
      mockFindMany.mockResolvedValue([{ id: 'usr-1', email: 'test@donor.org' }]);
      mockCount.mockResolvedValue(1);

      const result = await userRepo.findPaginated({
        page: 2,
        limit: 5,
        where: { status: 'ACTIVE' },
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('PatientRepository Role Filter', () => {
    it('should query user table filtering by PATIENT role', async () => {
      mockFindFirst.mockResolvedValue({ id: 'patient-1', email: 'patient@donor.org' });

      const patient = await patientRepo.findPatientById('patient-1');

      expect(patient).toBeDefined();
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          id: 'patient-1',
          role: { name: 'PATIENT' },
          deletedAt: null,
        },
        include: { role: true },
      });
    });
  });

  describe('InventoryRepository Optimistic Locking', () => {
    it('should update units when timestamps match', async () => {
      const now = new Date();
      mockUpdate.mockResolvedValue({ id: 'inv-1', unitsCount: 10 });

      const updated = await inventoryRepo.updateUnitsCountWithOptimisticLock('inv-1', 10, now);

      expect(updated.unitsCount).toBe(10);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: {
          id: 'inv-1',
          updatedAt: now,
        },
        data: {
          unitsCount: 10,
        },
      });
    });

    it('should throw ConflictError if timestamp does not match (Prisma P2025)', async () => {
      const now = new Date();
      const prismaError = new Error('Record not found');
      (prismaError as any).code = 'P2025';
      mockUpdate.mockRejectedValueOnce(prismaError);

      await expect(
        inventoryRepo.updateUnitsCountWithOptimisticLock('inv-1', 10, now),
      ).rejects.toThrow(ConflictError);
    });
  });
});
