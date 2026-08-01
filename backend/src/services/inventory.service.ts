import { PrismaClient, BloodInventory, BloodGroup, InventoryStatus } from '@prisma/client';
import { InventoryRepository } from '../repositories/inventory.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { BloodBankRepository } from '../repositories/blood-bank.repository';
import { redisService } from './redis.service';
import { BadRequestError, NotFoundError } from '../errors/app-error';
import logger from '../config/logger';

const prisma = new PrismaClient();

export class InventoryService {
  /**
   * Registers a new blood unit batch.
   */
  async registerBloodUnit(
    data: {
      bloodBankId: string;
      bloodGroup: BloodGroup;
      unitsCount: number;
      expiryDate: Date;
      status?: InventoryStatus;
    },
    userId?: string
  ): Promise<BloodInventory> {
    if (data.unitsCount <= 0) {
      throw new BadRequestError('Units count must be a positive integer.');
    }

    const expiryTime = new Date(data.expiryDate).getTime();
    if (expiryTime <= Date.now()) {
      throw new BadRequestError('Expiry date must be in the future.');
    }

    // Run within database transaction
    const inventory = await prisma.$transaction(async (tx) => {
      const inventoryRepo = new InventoryRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);
      const bloodBankRepo = new BloodBankRepository(tx as any);

      // Verify blood bank exists
      const bloodBank = await bloodBankRepo.findById(data.bloodBankId);
      if (!bloodBank) {
        throw new NotFoundError('Target Blood Bank profile not found.');
      }

      // Create unit record
      const record = await inventoryRepo.create({
        bloodBank: { connect: { id: data.bloodBankId } },
        bloodGroup: data.bloodGroup,
        unitsCount: data.unitsCount,
        expiryDate: new Date(data.expiryDate),
        status: data.status || 'AVAILABLE',
      });

      // Write audit log
      await auditLogRepo.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action: 'REGISTER_BLOOD_UNIT',
        details: {
          inventoryId: record.id,
          bloodBankId: data.bloodBankId,
          bloodGroup: data.bloodGroup,
          unitsCount: data.unitsCount,
        },
      });

      return record;
    });

    // Invalidate Redis stock cache
    await this.invalidateCache(data.bloodBankId);
    return inventory;
  }

  /**
   * Reserves a specific number of blood units from an available batch.
   */
  async reserveUnits(
    data: {
      inventoryId: string;
      unitsToReserve: number;
    },
    userId?: string
  ): Promise<BloodInventory> {
    if (data.unitsToReserve <= 0) {
      throw new BadRequestError('Reserve units count must be greater than zero.');
    }

    const reserved = await prisma.$transaction(async (tx) => {
      const inventoryRepo = new InventoryRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

      // Retrieve item
      const inventory = await inventoryRepo.findById(data.inventoryId);
      if (!inventory) {
        throw new NotFoundError('Blood inventory item not found.');
      }

      if (inventory.status !== 'AVAILABLE') {
        throw new BadRequestError(`Cannot reserve inventory with status: ${inventory.status}`);
      }

      if (inventory.unitsCount < data.unitsToReserve) {
        throw new BadRequestError('Insufficient blood units count in target batch.');
      }

      let reservedRecord: BloodInventory;

      if (inventory.unitsCount === data.unitsToReserve) {
        // Reserve the entire batch
        reservedRecord = await inventoryRepo.update(data.inventoryId, {
          status: 'RESERVED',
        });
      } else {
        // Fractional reservation
        const remainingCount = inventory.unitsCount - data.unitsToReserve;

        // Deduct from available using optimistic lock check
        await inventoryRepo.updateUnitsCountWithOptimisticLock(
          data.inventoryId,
          remainingCount,
          inventory.updatedAt
        );

        // Create new reserved record batch
        reservedRecord = await inventoryRepo.create({
          bloodBank: { connect: { id: inventory.bloodBankId } },
          bloodGroup: inventory.bloodGroup,
          unitsCount: data.unitsToReserve,
          expiryDate: inventory.expiryDate,
          status: 'RESERVED',
        });
      }

      // Audit Log
      await auditLogRepo.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action: 'RESERVE_BLOOD_UNITS',
        details: {
          originalInventoryId: data.inventoryId,
          reservedInventoryId: reservedRecord.id,
          unitsReserved: data.unitsToReserve,
          bloodBankId: inventory.bloodBankId,
        },
      });

      return reservedRecord;
    });

    // Invalidate Redis stock cache
    await this.invalidateCache(reserved.bloodBankId);
    return reserved;
  }

  /**
   * Releases a reserved blood unit batch back to available stock.
   */
  async releaseUnits(inventoryId: string, userId?: string): Promise<BloodInventory> {
    const released = await prisma.$transaction(async (tx) => {
      const inventoryRepo = new InventoryRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

      const inventory = await inventoryRepo.findById(inventoryId);
      if (!inventory) {
        throw new NotFoundError('Target reserved inventory batch not found.');
      }

      if (inventory.status !== 'RESERVED') {
        throw new BadRequestError('Only reserved inventory units can be released.');
      }

      // Revert status to available
      const updated = await inventoryRepo.update(inventoryId, {
        status: 'AVAILABLE',
      });

      // Audit Log
      await auditLogRepo.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action: 'RELEASE_BLOOD_UNITS',
        details: {
          inventoryId,
          unitsReleased: inventory.unitsCount,
          bloodBankId: inventory.bloodBankId,
        },
      });

      return updated;
    });

    // Invalidate Redis stock cache
    await this.invalidateCache(released.bloodBankId);
    return released;
  }

  /**
   * Background checker flagging expired inventory batches.
   */
  async checkAndFlagExpiredUnits(userId?: string): Promise<BloodInventory[]> {
    const now = new Date();
    const expiredList = await prisma.$transaction(async (tx) => {
      const inventoryRepo = new InventoryRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

      // Find expired items
      const expiredBatches = await tx.bloodInventory.findMany({
        where: {
          expiryDate: { lte: now },
          status: { in: ['AVAILABLE', 'RESERVED'] },
        },
      });

      const updatedList: BloodInventory[] = [];
      for (const batch of expiredBatches) {
        const updated = await inventoryRepo.update(batch.id, {
          status: 'EXPIRED',
        });
        updatedList.push(updated);

        // Log audit
        await auditLogRepo.create({
          user: userId ? { connect: { id: userId } } : undefined,
          action: 'EXPIRE_BLOOD_UNIT',
          details: {
            inventoryId: batch.id,
            bloodBankId: batch.bloodBankId,
            bloodGroup: batch.bloodGroup,
            unitsExpired: batch.unitsCount,
          },
        });
      }

      return updatedList;
    });

    // Invalidate caches for modified blood banks
    const bankIds = Array.from(new Set(expiredList.map((e) => e.bloodBankId)));
    for (const bankId of bankIds) {
      await this.invalidateCache(bankId);
    }

    if (expiredList.length > 0) {
      logger.info(`Successfully flagged ${expiredList.length} blood unit batches as EXPIRED.`);
    }

    return expiredList;
  }

  /**
   * Paginated search for inventory units with built-in Redis caching.
   */
  async searchInventory(params: {
    bloodBankId?: string;
    bloodGroup?: BloodGroup;
    status?: InventoryStatus;
    page?: number;
    limit?: number;
  }): Promise<{ items: BloodInventory[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 10;

    // Cache-aside pattern if filtering by bloodBankId
    if (params.bloodBankId) {
      try {
        const cachedString = await redisService.getInventory(params.bloodBankId);
        if (cachedString) {
          logger.debug(`Cache hit for blood bank inventory: ${params.bloodBankId}`);
          const allUnits: BloodInventory[] = JSON.parse(cachedString);

          // Apply filters in memory
          let filtered = allUnits;
          if (params.bloodGroup) {
            filtered = filtered.filter((u) => u.bloodGroup === params.bloodGroup);
          }
          if (params.status) {
            filtered = filtered.filter((u) => u.status === params.status);
          }

          // Apply pagination
          const start = (page - 1) * limit;
          const paginatedItems = filtered.slice(start, start + limit);

          return {
            items: paginatedItems,
            total: filtered.length,
          };
        }
      } catch (error: any) {
        logger.warn(`Redis getInventory failed for ${params.bloodBankId}: ${error.message}`);
      }
    }

    // Cache miss or listing everything
    const inventoryRepo = new InventoryRepository(prisma);
    const whereClause: any = {};
    if (params.bloodBankId) {
      whereClause.bloodBankId = params.bloodBankId;
    }
    if (params.bloodGroup) {
      whereClause.bloodGroup = params.bloodGroup;
    }
    if (params.status) {
      whereClause.status = params.status;
    }

    const result = await inventoryRepo.findPaginated({
      page,
      limit,
      where: whereClause,
      orderBy: { expiryDate: 'asc' },
    });

    // Populate Redis Cache if cache miss occurred for bloodBankId queries
    if (params.bloodBankId) {
      try {
        const allUnitsOfBank = await prisma.bloodInventory.findMany({
          where: { bloodBankId: params.bloodBankId },
          orderBy: { expiryDate: 'asc' },
        });
        await redisService.setInventory(params.bloodBankId, JSON.stringify(allUnitsOfBank), 3600);
      } catch (error: any) {
        logger.warn(`Redis setInventory failed for ${params.bloodBankId}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Helper to invalidate caches.
   */
  private async invalidateCache(bloodBankId: string) {
    try {
      await redisService.del(`inventory:${bloodBankId}`);
      logger.debug(`Invalidated cache key inventory:${bloodBankId}`);
    } catch (error: any) {
      logger.warn(`Failed to delete cache key for blood bank ${bloodBankId}: ${error.message}`);
    }
  }
}

export const inventoryService = new InventoryService();
