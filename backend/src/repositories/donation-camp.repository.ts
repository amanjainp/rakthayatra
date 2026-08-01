import { PrismaClient, DonationCamp, Prisma } from '@prisma/client';
import { BaseRepository, IBaseRepository } from './base.repository';

export interface IDonationCampRepository
  extends IBaseRepository<DonationCamp, Prisma.DonationCampCreateInput, Prisma.DonationCampUpdateInput> {
  findByCity(city: string, tx?: any): Promise<DonationCamp[]>;
  findActiveCamps(tx?: any): Promise<DonationCamp[]>;
}

export class DonationCampRepository
  extends BaseRepository<DonationCamp, Prisma.DonationCampCreateInput, Prisma.DonationCampUpdateInput>
  implements IDonationCampRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'donationCamp', true); // Supports soft delete
  }

  async findByCity(city: string, tx?: any): Promise<DonationCamp[]> {
    return this.getModel(tx).findMany({
      where: {
        city: {
          equals: city,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async findActiveCamps(tx?: any): Promise<DonationCamp[]> {
    const now = new Date();
    return this.getModel(tx).findMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
        status: 'ACTIVE',
        deletedAt: null,
      },
      orderBy: { endDate: 'asc' },
    });
  }
}
