import { rabbitMQService } from './rabbitmq.service';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import logger from '../config/logger';

const prisma = new PrismaClient();

export class NotificationService {
  /**
   * Publishes email alerts asynchronously through RabbitMQ.
   */
  async sendEmail(to: string, subject: string, body: string, eventId?: string): Promise<string> {
    const id = eventId || crypto.randomUUID();
    const payload = { id, to, subject, body, attempts: 0 };
    
    try {
      // Create audit record in PENDING state
      await prisma.notificationAudit.create({
        data: {
          eventId: id,
          type: 'EMAIL',
          recipient: to,
          subject,
          body,
          status: 'PENDING',
          attempts: 0,
        },
      });

      await rabbitMQService.publish('email.alerts', payload);
      logger.debug(`[NotificationService] Published email alert to RabbitMQ. EventId: ${id}`);
    } catch (err: any) {
      logger.error(`[NotificationService Error] Failed to publish email alert: ${err.message}`);
    }
    
    return id;
  }

  /**
   * Publishes SMS alerts asynchronously through RabbitMQ.
   */
  async sendSMS(phone: string, body: string, eventId?: string): Promise<string> {
    const id = eventId || crypto.randomUUID();
    const payload = { id, phone, body, attempts: 0 };

    try {
      // Create audit record in PENDING state
      await prisma.notificationAudit.create({
        data: {
          eventId: id,
          type: 'SMS',
          recipient: phone,
          body,
          status: 'PENDING',
          attempts: 0,
        },
      });

      await rabbitMQService.publish('sms.alerts', payload);
      logger.debug(`[NotificationService] Published SMS alert to RabbitMQ. EventId: ${id}`);
    } catch (err: any) {
      logger.error(`[NotificationService Error] Failed to publish SMS alert: ${err.message}`);
    }

    return id;
  }
}

export const notificationService = new NotificationService();
