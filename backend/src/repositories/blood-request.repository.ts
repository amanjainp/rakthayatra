import { PrismaClient, BloodRequest, Prisma, BloodGroup } from '@prisma/client';
import { BaseRepository, IBaseRepository } from './base.repository';

export interface IBloodRequestRepository
  extends IBaseRepository<BloodRequest, Prisma.BloodRequestCreateInput, Prisma.BloodRequestUpdateInput> {
  findByRequesterId(requesterId: string, tx?: any): Promise<BloodRequest[]>;
  findActiveRequests(tx?: any): Promise<BloodRequest[]>;
  findByBloodGroup(bloodGroup: BloodGroup, tx?: any): Promise<BloodRequest[]>;
}

export class BloodRequestRepository
  extends BaseRepository<BloodRequest, Prisma.BloodRequestCreateInput, Prisma.BloodRequestUpdateInput>
  implements IBloodRequestRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'bloodRequest', false); // No soft delete supported directly
  }

  async findByRequesterId(requesterId: string, tx?: any): Promise<BloodRequest[]> {
    return this.getModel(tx).findMany({
      where: { requesterId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveRequests(tx?: any): Promise<BloodRequest[]> {
    return this.getModel(tx).findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByBloodGroup(bloodGroup: BloodGroup, tx?: any): Promise<BloodRequest[]> {
    return this.getModel(tx).findMany({
      where: { bloodGroup, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }
}
