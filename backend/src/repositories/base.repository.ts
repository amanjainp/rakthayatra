import { PrismaClient } from '@prisma/client';
import { metricsService } from '../services/metrics.service';

export interface IBaseRepository<T, CreateInput, UpdateInput> {
  findById(id: string, tx?: any): Promise<T | null>;
  create(data: CreateInput, tx?: any): Promise<T>;
  update(id: string, data: UpdateInput, tx?: any): Promise<T>;
  delete(id: string, tx?: any): Promise<T>;
  findPaginated(
    params: {
      page?: number;
      limit?: number;
      where?: any;
      orderBy?: any;
      include?: any;
    },
    tx?: any
  ): Promise<{ items: T[]; total: number }>;
}

export abstract class BaseRepository<T, CreateInput, UpdateInput>
  implements IBaseRepository<T, CreateInput, UpdateInput>
{
  protected prisma: PrismaClient;
  protected modelName: string;
  protected supportsSoftDelete: boolean;

  constructor(prisma: PrismaClient, modelName: string, supportsSoftDelete = false) {
    this.prisma = prisma;
    this.modelName = modelName;
    this.supportsSoftDelete = supportsSoftDelete;
  }

  protected getModel(tx?: any) {
    const prismaInstance = tx || this.prisma;
    return prismaInstance[this.modelName];
  }

  private async executeWithTiming<R>(fn: () => Promise<R>): Promise<R> {
    const startTime = process.hrtime();
    try {
      const result = await fn();
      const diff = process.hrtime(startTime);
      const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;
      metricsService.recordPrismaQuery(durationMs);
      return result;
    } catch (error) {
      metricsService.recordPrismaFailure();
      throw error;
    }
  }

  async findById(id: string, tx?: any): Promise<T | null> {
    return this.executeWithTiming(async () => {
      const whereClause: any = { id };
      if (this.supportsSoftDelete) {
        whereClause.deletedAt = null;
      }
      return this.getModel(tx).findFirst({ where: whereClause });
    });
  }

  async create(data: CreateInput, tx?: any): Promise<T> {
    return this.executeWithTiming(async () => {
      return this.getModel(tx).create({ data });
    });
  }

  async update(id: string, data: UpdateInput, tx?: any): Promise<T> {
    return this.executeWithTiming(async () => {
      return this.getModel(tx).update({
        where: { id },
        data,
      });
    });
  }

  async delete(id: string, tx?: any): Promise<T> {
    return this.executeWithTiming(async () => {
      if (this.supportsSoftDelete) {
        return this.getModel(tx).update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      }
      return this.getModel(tx).delete({
        where: { id },
      });
    });
  }

  async findPaginated(
    params: {
      page?: number;
      limit?: number;
      where?: any;
      orderBy?: any;
      include?: any;
    },
    tx?: any
  ): Promise<{ items: T[]; total: number }> {
    return this.executeWithTiming(async () => {
      const page = params.page || 1;
      const limit = params.limit || 10;
      const skip = (page - 1) * limit;

      const whereClause = { ...params.where };
      if (this.supportsSoftDelete) {
        whereClause.deletedAt = null;
      }

      const [items, total] = await Promise.all([
        this.getModel(tx).findMany({
          where: whereClause,
          orderBy: params.orderBy,
          include: params.include,
          skip,
          take: limit,
        }),
        this.getModel(tx).count({
          where: whereClause,
        }),
      ]);

      return { items, total };
    });
  }
}
