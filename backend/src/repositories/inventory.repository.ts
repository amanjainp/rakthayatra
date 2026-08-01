import { PrismaClient, BloodInventory, Prisma, BloodGroup } from '@prisma/client';
import { BaseRepository, IBaseRepository } from './base.repository';
import { ConflictError } from '../errors/app-error';

export interface IInventoryRepository
  extends IBaseRepository<BloodInventory, Prisma.BloodInventoryCreateInput, Prisma.BloodInventoryUpdateInput> {
  findByBloodBankAndGroup(bloodBankId: string, bloodGroup: BloodGroup, tx?: any): Promise<BloodInventory | null>;
  updateUnitsCountWithOptimisticLock(
    id: string,
    newCount: number,
    expectedUpdatedAt: Date,
    tx?: any
  ): Promise<BloodInventory>;
  findLowStock(threshold: number, tx?: any): Promise<BloodInventory[]>;
}

export class InventoryRepository
  extends BaseRepository<BloodInventory, Prisma.BloodInventoryCreateInput, Prisma.BloodInventoryUpdateInput>
  implements IInventoryRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'bloodInventory', false); // No soft delete supported directly
  }

  async findByBloodBankAndGroup(bloodBankId: string, bloodGroup: BloodGroup, tx?: any): Promise<BloodInventory | null> {
    return this.getModel(tx).findFirst({
      where: { bloodBankId, bloodGroup },
    });
  }

  /**
   * Safe updates using Optimistic Locking.
   * Compares the target record's updatedAt timestamp and throws a ConflictError if a concurrent query modified it.
   */
  async updateUnitsCountWithOptimisticLock(
    id: string,
    newCount: number,
    expectedUpdatedAt: Date,
    tx?: any
  ): Promise<BloodInventory> {
    try {
      return await this.getModel(tx).update({
        where: {
          id,
          updatedAt: expectedUpdatedAt,
        },
        data: {
          unitsCount: newCount,
        },
      });
    } catch (error: any) {
      // Prisma error code for constraint/where clause failure: P2025
      if (error.code === 'P2025') {
        throw new ConflictError('Concurrent update detected on blood inventory. Please retry the operation.');
      }
      throw error;
    }
  }

  async findLowStock(threshold: number, tx?: any): Promise<BloodInventory[]> {
    return this.getModel(tx).findMany({
      where: {
        unitsCount: {
          lte: threshold,
        },
        status: 'AVAILABLE',
      },
      include: {
        bloodBank: true,
      },
    });
  }
}
