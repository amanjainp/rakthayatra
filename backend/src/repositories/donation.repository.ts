import { PrismaClient, Donation, Prisma } from '@prisma/client';
import { BaseRepository, IBaseRepository } from './base.repository';

export interface IDonationRepository
  extends IBaseRepository<Donation, Prisma.DonationCreateInput, Prisma.DonationUpdateInput> {
  findByDonorProfileId(donorProfileId: string, tx?: any): Promise<Donation[]>;
  findByCampId(donationCampId: string, tx?: any): Promise<Donation[]>;
  findByBloodBankId(bloodBankId: string, tx?: any): Promise<Donation[]>;
}

export class DonationRepository
  extends BaseRepository<Donation, Prisma.DonationCreateInput, Prisma.DonationUpdateInput>
  implements IDonationRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'donation', false); // No soft delete supported directly
  }

  async findByDonorProfileId(donorProfileId: string, tx?: any): Promise<Donation[]> {
    return this.getModel(tx).findMany({
      where: { donorProfileId },
      orderBy: { donationDate: 'desc' },
    });
  }

  async findByCampId(donationCampId: string, tx?: any): Promise<Donation[]> {
    return this.getModel(tx).findMany({
      where: { donationCampId },
      orderBy: { donationDate: 'desc' },
    });
  }

  async findByBloodBankId(bloodBankId: string, tx?: any): Promise<Donation[]> {
    return this.getModel(tx).findMany({
      where: { bloodBankId },
      orderBy: { donationDate: 'desc' },
    });
  }
}
