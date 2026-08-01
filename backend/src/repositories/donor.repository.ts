import { PrismaClient, DonorProfile, Prisma, BloodGroup } from '@prisma/client';
import { BaseRepository, IBaseRepository } from './base.repository';

export interface IDonorRepository
  extends IBaseRepository<DonorProfile, Prisma.DonorProfileCreateInput, Prisma.DonorProfileUpdateInput> {
  findByUserId(userId: string, tx?: any): Promise<DonorProfile | null>;
  findByPhone(phone: string, tx?: any): Promise<DonorProfile | null>;
  findAvailableByBloodGroup(bloodGroup: BloodGroup, tx?: any): Promise<DonorProfile[]>;
}

export class DonorRepository
  extends BaseRepository<DonorProfile, Prisma.DonorProfileCreateInput, Prisma.DonorProfileUpdateInput>
  implements IDonorRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'donorProfile', true); // Supports soft delete
  }

  async findByUserId(userId: string, tx?: any): Promise<DonorProfile | null> {
    return this.getModel(tx).findFirst({
      where: { userId, deletedAt: null },
    });
  }

  async findByPhone(phone: string, tx?: any): Promise<DonorProfile | null> {
    return this.getModel(tx).findFirst({
      where: { phone, deletedAt: null },
    });
  }

  async findAvailableByBloodGroup(bloodGroup: BloodGroup, tx?: any): Promise<DonorProfile[]> {
    return this.getModel(tx).findMany({
      where: {
        bloodGroup,
        isAvailable: true,
        deletedAt: null,
      },
    });
  }
}
