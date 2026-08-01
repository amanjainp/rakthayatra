import { PrismaClient, BloodBankProfile, Prisma } from '@prisma/client';
import { BaseRepository, IBaseRepository } from './base.repository';

export interface IBloodBankRepository
  extends IBaseRepository<BloodBankProfile, Prisma.BloodBankProfileCreateInput, Prisma.BloodBankProfileUpdateInput> {
  findByUserId(userId: string, tx?: any): Promise<BloodBankProfile | null>;
  findByLicenseNumber(licenseNumber: string, tx?: any): Promise<BloodBankProfile | null>;
  findVerified(tx?: any): Promise<BloodBankProfile[]>;
}

export class BloodBankRepository
  extends BaseRepository<BloodBankProfile, Prisma.BloodBankProfileCreateInput, Prisma.BloodBankProfileUpdateInput>
  implements IBloodBankRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'bloodBankProfile', true); // Supports soft delete
  }

  async findByUserId(userId: string, tx?: any): Promise<BloodBankProfile | null> {
    return this.getModel(tx).findFirst({
      where: { userId, deletedAt: null },
    });
  }

  async findByLicenseNumber(licenseNumber: string, tx?: any): Promise<BloodBankProfile | null> {
    return this.getModel(tx).findFirst({
      where: { licenseNumber, deletedAt: null },
    });
  }

  async findVerified(tx?: any): Promise<BloodBankProfile[]> {
    return this.getModel(tx).findMany({
      where: { isVerified: true, deletedAt: null },
    });
  }
}
