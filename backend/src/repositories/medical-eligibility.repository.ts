import { PrismaClient, MedicalEligibility, Prisma } from '@prisma/client';
import { BaseRepository, IBaseRepository } from './base.repository';

export interface IMedicalEligibilityRepository
  extends IBaseRepository<MedicalEligibility, Prisma.MedicalEligibilityCreateInput, Prisma.MedicalEligibilityUpdateInput> {
  findByDonorId(donorProfileId: string, tx?: any): Promise<MedicalEligibility | null>;
}

export class MedicalEligibilityRepository
  extends BaseRepository<MedicalEligibility, Prisma.MedicalEligibilityCreateInput, Prisma.MedicalEligibilityUpdateInput>
  implements IMedicalEligibilityRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'medicalEligibility', false); // No soft delete supported directly
  }

  async findByDonorId(donorProfileId: string, tx?: any): Promise<MedicalEligibility | null> {
    return this.getModel(tx).findFirst({
      where: { donorProfileId },
    });
  }
}
