import { rabbitMQService } from '../services/rabbitmq.service';
import logger from '../config/logger';

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
    logger.info(`[Worker: Email] Sending SMTP email alert to ${msg.to}. Topic: ${msg.subject}`);
  });

  // 4. SMS alert queue subscriber
  await rabbitMQService.consume('lifelink.queue.sms', async (msg: any) => {
    logger.info(`[Worker: SMS] Direct dispatching SMS text alert to: ${msg.phone}`);
  });

  logger.info('All background queue workers registered successfully.');
}
