import { rabbitMQService } from '../services/rabbitmq.service';
import { providerFactory } from '../providers/provider.factory';
import { redisService } from '../services/redis.service';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

export async function bootstrapWorkers(): Promise<void> {
  logger.info('Initializing LifeLink background worker subscribers...');

  // 1. Notification queue subscriber
  await rabbitMQService.consume('lifelink.queue.notification', async (msg: any) => {
    logger.info(`[Worker: Notification] Dispatching alert message: ${JSON.stringify(msg)}`);
  });

  // 2. Audit logger queue subscriber
  await rabbitMQService.consume('lifelink.queue.audit', async (msg: any) => {
    logger.info(`[Worker: Audit] Writing audit activity: ${JSON.stringify(msg)}`);
  });

  // 3. Email dispatcher queue subscriber
  await rabbitMQService.consume('lifelink.queue.email', async (msg: any) => {
    const eventId = msg.id || 'unknown';
    const attempts = msg.attempts || 0;

    // Idempotency check: Set lock key in Redis
    const idempotencyKey = `notification:idempotency:email:${eventId}`;
    const isUnique = await redisService.setNX(idempotencyKey, 'PROCESSED', 86400);
    if (!isUnique) {
      logger.info(`[Worker: Idempotency] Duplicate email event detected. Skipping dispatch for event: ${eventId}`);
      return;
    }

    try {
      const emailProvider = providerFactory.getEmailProvider();
      const result = await emailProvider.send({
        to: msg.to,
        subject: msg.subject,
        body: msg.body,
        eventId,
      });

      if (result.success) {
        // Update database audit log to DELIVERED
        await prisma.notificationAudit.updateMany({
          where: { eventId },
          data: {
            status: 'DELIVERED',
            provider: 'SMTP',
            attempts: attempts + 1,
          },
        });
      } else {
        throw new Error(result.error || 'SMTP delivery failed');
      }
    } catch (error: any) {
      // Clean idempotency key so retry can execute
      await redisService.del(idempotencyKey);

      const nextAttempts = attempts + 1;
      if (nextAttempts < 3) {
        logger.warn(`[Worker: Email Retry] Email sending failed. Retrying... Attempt ${nextAttempts} of 3. Error: ${error.message}`);
        msg.attempts = nextAttempts;
        await rabbitMQService.publish('email.alerts', msg);
      } else {
        logger.error(`[Worker: Email DLQ] Retries exhausted for email ${msg.to}. Pushing to DLQ. Error: ${error.message}`);
        
        await prisma.notificationAudit.updateMany({
          where: { eventId },
          data: {
            status: 'DLQ',
            failureReason: error.message || 'SMTP transmission timeout',
            attempts: nextAttempts,
          },
        });

        throw new Error(`SMTP delivery retries exhausted: ${error.message}`);
      }
    }
  });

  // 4. SMS alert queue subscriber
  await rabbitMQService.consume('lifelink.queue.sms', async (msg: any) => {
    const eventId = msg.id || 'unknown';
    const attempts = msg.attempts || 0;

    // Idempotency check: Set lock key in Redis
    const idempotencyKey = `notification:idempotency:sms:${eventId}`;
    const isUnique = await redisService.setNX(idempotencyKey, 'PROCESSED', 86400);
    if (!isUnique) {
      logger.info(`[Worker: Idempotency] Duplicate SMS event detected. Skipping dispatch for event: ${eventId}`);
      return;
    }

    try {
      const smsProvider = providerFactory.getSMSProvider();
      const result = await smsProvider.send({
        phone: msg.phone,
        body: msg.body,
        eventId,
      });

      if (result.success) {
        // Update database audit log to DELIVERED
        await prisma.notificationAudit.updateMany({
          where: { eventId },
          data: {
            status: 'DELIVERED',
            provider: 'TWILIO',
            attempts: attempts + 1,
          },
        });
      } else {
        throw new Error(result.error || 'Twilio SMS delivery failed');
      }
    } catch (error: any) {
      // Clean idempotency key so retry can execute
      await redisService.del(idempotencyKey);

      const nextAttempts = attempts + 1;
      if (nextAttempts < 3) {
        logger.warn(`[Worker: SMS Retry] SMS sending failed. Retrying... Attempt ${nextAttempts} of 3. Error: ${error.message}`);
        msg.attempts = nextAttempts;
        await rabbitMQService.publish('sms.alerts', msg);
      } else {
        logger.error(`[Worker: SMS DLQ] Retries exhausted for SMS ${msg.phone}. Pushing to DLQ. Error: ${error.message}`);
        
        await prisma.notificationAudit.updateMany({
          where: { eventId },
          data: {
            status: 'DLQ',
            failureReason: error.message || 'Twilio SMS gateway timeout',
            attempts: nextAttempts,
          },
        });

        throw new Error(`SMS delivery retries exhausted: ${error.message}`);
      }
    }
  });

  logger.info('All background queue workers registered successfully.');
}
