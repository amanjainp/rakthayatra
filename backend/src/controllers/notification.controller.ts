import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

export class NotificationController {
  /**
   * GET /api/notifications
   * Retrieves all notifications for the authenticated user, sorted latest first.
   */
  async getMyNotifications(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      // Format for frontend interface compatibility (read -> isRead, body -> message)
      const formatted = notifications.map((n) => ({
        id: n.id,
        userId: n.userId,
        title: n.title,
        body: n.message,
        message: n.message,
        type: n.type,
        read: n.isRead,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      }));

      return res.status(200).json({
        success: true,
        data: formatted,
      });
    } catch (error: any) {
      logger.error('Error fetching notifications:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
    }
  }

  /**
   * POST /api/notifications/:id/read
   * Mark a specific notification as read.
   */
  async markAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification || notification.userId !== userId) {
        return res.status(404).json({ success: false, error: 'Notification not found' });
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      logger.error('Error marking notification as read:', error);
      return res.status(500).json({ success: false, error: 'Failed to update notification' });
    }
  }

  /**
   * POST /api/notifications/read-all
   * Mark all notifications for the authenticated user as read.
   */
  async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      return res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error: any) {
      logger.error('Error marking all notifications as read:', error);
      return res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
    }
  }
}

export const notificationController = new NotificationController();
