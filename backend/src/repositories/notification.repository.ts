import { PrismaClient, Notification, Prisma } from '@prisma/client';
import { BaseRepository, IBaseRepository } from './base.repository';

export interface INotificationRepository
  extends IBaseRepository<Notification, Prisma.NotificationCreateInput, Prisma.NotificationUpdateInput> {
  findByUserId(userId: string, tx?: any): Promise<Notification[]>;
  findUnreadByUserId(userId: string, tx?: any): Promise<Notification[]>;
  markAllAsRead(userId: string, tx?: any): Promise<void>;
}

export class NotificationRepository
  extends BaseRepository<Notification, Prisma.NotificationCreateInput, Prisma.NotificationUpdateInput>
  implements INotificationRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'notification', false); // No soft delete supported directly
  }

  async findByUserId(userId: string, tx?: any): Promise<Notification[]> {
    return this.getModel(tx).findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findUnreadByUserId(userId: string, tx?: any): Promise<Notification[]> {
    return this.getModel(tx).findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAllAsRead(userId: string, tx?: any): Promise<void> {
    await this.getModel(tx).updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
