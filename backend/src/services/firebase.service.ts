import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaClient, NotificationType } from '@prisma/client';
import { env } from '../config/env';
import logger from '../config/logger';
import { BadRequestError, InternalServerError } from '../errors/app-error';
import { metricsService } from './metrics.service';

const prisma = new PrismaClient();

export const NotificationTemplates = {
  EMERGENCY_ALERT: (bloodGroup: string, location: string, units: number) => ({
    title: `🚨 URGENT: ${bloodGroup} Blood Request`,
    body: `Emergency! ${units} units of ${bloodGroup} blood are needed immediately at ${location}.`,
  }),
  DONATION_REMINDER: () => ({
    title: '❤️ LifeLink Blood Donation Eligibility',
    body: 'Greetings! You are now eligible to donate blood again. Schedule a donation today!',
  }),
  REQUEST_UPDATE: (status: string) => ({
    title: '📋 Blood Request Status Update',
    body: `Your request status has been updated to "${status}". Check LifeLink for details.`,
  }),
};

export class FirebaseService {
  private isMockMode = false;
  private retryQueue: Array<{
    token: string;
    message: any;
    attempts: number;
  }> = [];

  constructor() {
    // Validate firebase configs
    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
      logger.warn('Firebase parameters not configured in env. FirebaseService is running in MOCK mode.');
      this.isMockMode = true;
    } else {
      try {
        initializeApp({
          credential: cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
        logger.info('Firebase Admin Client successfully initialized.');
      } catch (error: any) {
        logger.error(`Failed to initialize Firebase Admin Client: ${error.message}`);
        this.isMockMode = true;
      }
    }
  }

  public getMockMode(): boolean {
    return this.isMockMode;
  }

  /**
   * Registers a unique device token for a user.
   */
  async registerDeviceToken(userId: string, token: string): Promise<void> {
    if (!userId || !token) {
      throw new BadRequestError('UserId and Token parameters are required.');
    }

    try {
      await prisma.deviceToken.upsert({
        where: { token },
        update: { userId },
        create: { token, userId },
      });
      logger.info(`Device token registered successfully for user: ${userId}`);
    } catch (error: any) {
      logger.error(`Failed to register device token: ${error.message}`);
      throw new InternalServerError('Failed to save device registration token.');
    }
  }

  /**
   * De-registers a device token (e.g. on user logout).
   */
  async deregisterDeviceToken(token: string): Promise<void> {
    if (!token) {
      throw new BadRequestError('Token parameter is required.');
    }

    try {
      await prisma.deviceToken.deleteMany({
        where: { token },
      });
      logger.info('Device token de-registered successfully.');
    } catch (error: any) {
      logger.error(`Failed to de-register device token: ${error.message}`);
      throw new InternalServerError('Failed to remove device registration token.');
    }
  }

  /**
   * Sends a push notification to all devices registered to a specific user.
   */
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    type: NotificationType,
    data?: Record<string, string>,
  ): Promise<void> {
    // 1. Fetch user's registered device tokens
    const tokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });

    // 2. Save notification to history
    await prisma.notification.create({
      data: {
        userId,
        title,
        message: body,
        type,
      },
    });

    metricsService.recordNotificationSent(type);

    if (tokens.length === 0) {
      logger.debug(`No device tokens found for user: ${userId}. Saved to notification history.`);
      return;
    }

    for (const t of tokens) {
      const message = {
        token: t.token,
        notification: { title, body },
        data: data || {},
      };

      if (this.isMockMode) {
        logger.info(`[MOCK] Push Notification sent to token: ${t.token.substring(0, 10)}...: ${title}`);
      } else {
        try {
          await getMessaging().send(message);
        } catch (error: any) {
          logger.warn(`Push Notification send failed for token ${t.token.substring(0, 10)}...: ${error.message}`);
          this.enqueueRetry(t.token, message);
        }
      }
    }
  }

  /**
   * Broadcasts a push message to a topic (e.g., for emergencies).
   */
  async broadcastToTopic(
    topic: string,
    title: string,
    body: string,
    _type: NotificationType,
    data?: Record<string, string>,
  ): Promise<void> {
    metricsService.recordNotificationSent(_type);

    if (this.isMockMode) {
      logger.info(`[MOCK] Topic Broadcast sent to topic "${topic}": Title="${title}"`);
      return;
    }

    const message = {
      topic,
      notification: { title, body },
      data: data || {},
    };

    try {
      await getMessaging().send(message);
      logger.info(`Topic Broadcast succeeded for topic: ${topic}`);
    } catch (error: any) {
      logger.error(`Topic Broadcast failed for topic ${topic}: ${error.message}`);
      throw new InternalServerError('Failed to broadcast topic notification.');
    }
  }

  /**
   * Enqueues a failed push notification payload into local memory queue for retrying.
   */
  private enqueueRetry(token: string, message: any, attempts = 1): void {
    this.retryQueue.push({ token, message, attempts });
    logger.warn(`Notification queued for retry. Token: ${token.substring(0, 10)}... Attempts: ${attempts}`);

    setTimeout(async () => {
      await this.processRetryQueue();
    }, 2000 * attempts); // Exponential delay multiplication
  }

  private async processRetryQueue(): Promise<void> {
    const item = this.retryQueue.shift();
    if (!item) return;

    try {
      if (this.isMockMode) {
        logger.info(`[MOCK] Retrying notification delivery to token: ${item.token.substring(0, 10)}...`);
      } else {
        await getMessaging().send(item.message);
      }
      logger.info(`Notification retry succeeded for token: ${item.token.substring(0, 10)}...`);
    } catch (error: any) {
      logger.warn(`Notification retry failed (attempt ${item.attempts}/3) for token ${item.token.substring(0, 10)}...: ${error.message}`);
      if (item.attempts < 3) {
        this.enqueueRetry(item.token, item.message, item.attempts + 1);
      } else {
        logger.error(`Max retries reached. Notification discarded for token: ${item.token.substring(0, 10)}...`);
      }
    }
  }
}

export const firebaseService = new FirebaseService();
