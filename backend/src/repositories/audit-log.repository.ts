import { PrismaClient, AuditLog, Prisma } from '@prisma/client';
import { BaseRepository, IBaseRepository } from './base.repository';

export interface IAuditLogRepository
  extends IBaseRepository<AuditLog, Prisma.AuditLogCreateInput, Prisma.AuditLogUpdateInput> {
  findByUserId(userId: string, tx?: any): Promise<AuditLog[]>;
  findByAction(action: string, tx?: any): Promise<AuditLog[]>;
}

export class AuditLogRepository
  extends BaseRepository<AuditLog, Prisma.AuditLogCreateInput, Prisma.AuditLogUpdateInput>
  implements IAuditLogRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'auditLog', false); // No soft delete supported directly
  }

  async findByUserId(userId: string, tx?: any): Promise<AuditLog[]> {
    return this.getModel(tx).findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByAction(action: string, tx?: any): Promise<AuditLog[]> {
    return this.getModel(tx).findMany({
      where: { action },
      orderBy: { createdAt: 'desc' },
    });
  }
}
