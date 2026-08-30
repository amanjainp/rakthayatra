import { providerFactory } from '../src/providers/provider.factory';
import { DevelopmentEmailProvider } from '../src/providers/email/development-email.provider';
import { ProductionEmailProvider } from '../src/providers/email/production-email.provider';
import { DevelopmentSMSProvider } from '../src/providers/sms/development-sms.provider';
import { ProductionSMSProvider } from '../src/providers/sms/production-sms.provider';
import { redisService } from '../src/services/redis.service';
import { notificationService } from '../src/services/notification.service';
import { bootstrapWorkers } from '../src/workers';
import { rabbitMQService } from '../src/services/rabbitmq.service';
import { PrismaClient } from '@prisma/client';

jest.mock('../src/services/rabbitmq.service', () => ({
  rabbitMQService: {
    publish: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@prisma/client', () => {
  const original = jest.requireActual('@prisma/client');
  const mPrisma = {
    notificationAudit: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return {
    ...original,
    PrismaClient: jest.fn().mockImplementation(() => mPrisma),
  };
});

describe('Production Notification System Integration Tests', () => {
  const prismaMock = new PrismaClient();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider Factory Resolution Mappings', () => {
    it('should resolve mock providers in development/test environments', () => {
      const emailProvider = providerFactory.getEmailProvider();
      const smsProvider = providerFactory.getSMSProvider();

      expect(emailProvider).toBeInstanceOf(DevelopmentEmailProvider);
      expect(smsProvider).toBeInstanceOf(DevelopmentSMSProvider);
    });

    it('should support creation of production implementations', () => {
      const prodEmail = new ProductionEmailProvider();
      const prodSMS = new ProductionSMSProvider();

      expect(prodEmail).toBeInstanceOf(ProductionEmailProvider);
      expect(prodSMS).toBeInstanceOf(ProductionSMSProvider);
    });
  });

  describe('Notification Dispatch & RabbitMQ Publishing', () => {
    it('should create audit record in PENDING state and publish email to queue', async () => {
      const eventId = 'test-event-email-123';
      await notificationService.sendEmail('test@donor.org', 'Urgent Help Needed', 'Body details', eventId);

      expect(prismaMock.notificationAudit.create).toHaveBeenCalledWith({
        data: {
          eventId,
          type: 'EMAIL',
          recipient: 'test@donor.org',
          subject: 'Urgent Help Needed',
          body: 'Body details',
          status: 'PENDING',
          attempts: 0,
        },
      });
      expect(rabbitMQService.publish).toHaveBeenCalledWith('email.alerts', expect.objectContaining({
        id: eventId,
        to: 'test@donor.org',
      }));
    });

    it('should create audit record in PENDING state and publish SMS to queue', async () => {
      const eventId = 'test-event-sms-123';
      await notificationService.sendSMS('+123456789', 'Body message text', eventId);

      expect(prismaMock.notificationAudit.create).toHaveBeenCalledWith({
        data: {
          eventId,
          type: 'SMS',
          recipient: '+123456789',
          body: 'Body message text',
          status: 'PENDING',
          attempts: 0,
        },
      });
      expect(rabbitMQService.publish).toHaveBeenCalledWith('sms.alerts', expect.objectContaining({
        id: eventId,
        phone: '+123456789',
      }));
    });
  });

  describe('Idempotency Lock Verifications', () => {
    it('should prevent duplicate notification sends using Redis setNX', async () => {
      const setNXSpy = jest.spyOn(redisService, 'setNX').mockResolvedValue(false); // Key already exists

      // Retrieve registered callback from bootstrap
      let emailCallback: any;
      (rabbitMQService.consume as jest.Mock).mockImplementation((queue, callback) => {
        if (queue === 'lifelink.queue.email') {
          emailCallback = callback;
        }
      });

      await bootstrapWorkers();
      expect(emailCallback).toBeDefined();

      const msg = { id: 'dup-event-123', to: 'test@lifelink.org', subject: 'Hi', body: 'Test' };
      await emailCallback(msg);

      expect(setNXSpy).toHaveBeenCalledWith('notification:idempotency:email:dup-event-123', 'PROCESSED', 86400);
      expect(prismaMock.notificationAudit.updateMany).not.toHaveBeenCalled();
      setNXSpy.mockRestore();
    });
  });

  describe('SMTP Production Error & Timeouts Handling', () => {
    it('should return failure status when connection fails', async () => {
      const prodEmail = new ProductionEmailProvider();
      const result = await prodEmail.send({
        to: 'invalid-email',
        subject: 'Test',
        body: 'Body',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Worker Retries and DLQ Routing Execution Flow', () => {
    it('should execute retry manually up to 3 times before declaring DLQ status', async () => {
      // Mock provider failure
      const emailProvider = providerFactory.getEmailProvider();
      jest.spyOn(emailProvider, 'send').mockResolvedValue({ success: false, error: 'SMTP Timeout' });
      jest.spyOn(redisService, 'setNX').mockResolvedValue(true);
      const delSpy = jest.spyOn(redisService, 'del').mockResolvedValue(undefined);

      let emailCallback: any;
      (rabbitMQService.consume as jest.Mock).mockImplementation((queue, callback) => {
        if (queue === 'lifelink.queue.email') {
          emailCallback = callback;
        }
      });

      await bootstrapWorkers();

      // Case 1: Initial failure, attempt count < 3 (attempts = 0)
      const msg = { id: 'retry-event-abc', to: 'fail@donor.org', subject: 'Subject', body: 'Body', attempts: 0 };
      await emailCallback(msg);

      expect(delSpy).toHaveBeenCalledWith('notification:idempotency:email:retry-event-abc');
      expect(rabbitMQService.publish).toHaveBeenCalledWith('email.alerts', expect.objectContaining({
        attempts: 1,
      }));

      // Case 2: Exhausted failures, attempts = 2 (attempts + 1 = 3)
      const msgExhausted = { id: 'retry-event-abc', to: 'fail@donor.org', subject: 'Subject', body: 'Body', attempts: 2 };
      await expect(emailCallback(msgExhausted)).rejects.toThrow('SMTP delivery retries exhausted');

      expect(prismaMock.notificationAudit.updateMany).toHaveBeenCalledWith({
        where: { eventId: 'retry-event-abc' },
        data: {
          status: 'DLQ',
          failureReason: 'SMTP Timeout',
          attempts: 3,
        },
      });
      delSpy.mockRestore();
    });
  });
});
