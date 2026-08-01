import { PrismaClient, HospitalProfile, Prisma } from '@prisma/client';
import { BaseRepository, IBaseRepository } from './base.repository';

export interface IHospitalRepository
  extends IBaseRepository<HospitalProfile, Prisma.HospitalProfileCreateInput, Prisma.HospitalProfileUpdateInput> {
  findByUserId(userId: string, tx?: any): Promise<HospitalProfile | null>;
  findByLicenseNumber(licenseNumber: string, tx?: any): Promise<HospitalProfile | null>;
  findVerified(tx?: any): Promise<HospitalProfile[]>;
}

export class HospitalRepository
  extends BaseRepository<HospitalProfile, Prisma.HospitalProfileCreateInput, Prisma.HospitalProfileUpdateInput>
  implements IHospitalRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'hospitalProfile', true); // Supports soft delete
  }

  async findByUserId(userId: string, tx?: any): Promise<HospitalProfile | null> {
    return this.getModel(tx).findFirst({
      where: { userId, deletedAt: null },
    });
  }

  async findByLicenseNumber(licenseNumber: string, tx?: any): Promise<HospitalProfile | null> {
    return this.getModel(tx).findFirst({
      where: { licenseNumber, deletedAt: null },
    });
  }

  async findVerified(tx?: any): Promise<HospitalProfile[]> {
    return this.getModel(tx).findMany({
      where: { isVerified: true, deletedAt: null },
    });
  }
}
