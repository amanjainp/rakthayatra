import { PrismaClient, User, Role } from '@prisma/client';

const prisma = new PrismaClient();

export class UserRepository {
  async findById(id: string): Promise<(User & { role: Role }) | null> {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    }) as Promise<(User & { role: Role }) | null>;
  }

  async findByEmail(email: string): Promise<(User & { role: Role }) | null> {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { role: true },
    }) as Promise<(User & { role: Role }) | null>;
  }

  async create(data: { email: string; passwordHash: string; roleId: string }): Promise<User> {
    return prisma.user.create({
      data,
    });
  }

  async update(id: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
