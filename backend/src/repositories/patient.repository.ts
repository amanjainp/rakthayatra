import { PrismaClient, User, Prisma } from '@prisma/client';
import { BaseRepository, IBaseRepository } from './base.repository';

export interface IPatientRepository
  extends IBaseRepository<User, Prisma.UserCreateInput, Prisma.UserUpdateInput> {
  findPatientById(id: string, tx?: any): Promise<User | null>;
  findPatientByEmail(email: string, tx?: any): Promise<User | null>;
}

export class PatientRepository
  extends BaseRepository<User, Prisma.UserCreateInput, Prisma.UserUpdateInput>
  implements IPatientRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'user', true); // Acts on User table
  }

  async findPatientById(id: string, tx?: any): Promise<User | null> {
    return this.getModel(tx).findFirst({
      where: {
        id,
        role: { name: 'PATIENT' },
        deletedAt: null,
      },
      include: { role: true },
    });
  }

  async findPatientByEmail(email: string, tx?: any): Promise<User | null> {
    return this.getModel(tx).findFirst({
      where: {
        email,
        role: { name: 'PATIENT' },
        deletedAt: null,
      },
      include: { role: true },
    });
  }
}
