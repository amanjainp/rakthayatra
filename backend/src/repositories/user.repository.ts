import { PrismaClient, User, Role, Prisma } from '@prisma/client';
import { BaseRepository, IBaseRepository } from './base.repository';

export interface IUserRepository extends IBaseRepository<User, Prisma.UserCreateInput, Prisma.UserUpdateInput> {
  findByEmail(email: string, tx?: any): Promise<(User & { role: Role }) | null>;
}

export class UserRepository
  extends BaseRepository<User, Prisma.UserCreateInput, Prisma.UserUpdateInput>
  implements IUserRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'user', true); // Supports soft delete
  }

  async findByEmail(email: string, tx?: any): Promise<(User & { role: Role }) | null> {
    return this.getModel(tx).findFirst({
      where: { email, deletedAt: null },
      include: { role: true },
    });
  }
}
