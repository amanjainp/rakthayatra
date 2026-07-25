import { FirebaseService, NotificationTemplates } from '../src/services/firebase.service';
import { BadRequestError } from '../src/errors/app-error';
import { PrismaClient, NotificationType } from '@prisma/client';

// Mock Prisma client mapping
jest.mock('@prisma/client', () => {
  const localMockPrisma = {
    deviceToken: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn().mockImplementation(() => localMockPrisma),
    NotificationType: {
      EMERGENCY_ALERT: 'EMERGENCY_ALERT',
      DONATION_REMINDER: 'DONATION_REMINDER',
      REQUEST_UPDATE: 'REQUEST_UPDATE',
    },
    BloodGroup: {
      O_NEG: 'O_NEG',
      O_POS: 'O_POS',
      A_NEG: 'A_NEG',
      A_POS: 'A_POS',
      B_NEG: 'B_NEG',
      B_POS: 'B_POS',
      AB_NEG: 'AB_NEG',
      AB_POS: 'AB_POS',
    },
  };
});

const prisma = new PrismaClient() as any;

// Mock Firebase Admin messaging client
jest.mock('firebase-admin/app', () => {
  return {
    cert: jest.fn(),
    initializeApp: jest.fn(),
  };
});

const mockSend = jest.fn();
jest.mock('firebase-admin/messaging', () => {
  return {
    getMessaging: () => ({
      send: mockSend,
    }),
  };
});

describe('FirebaseService Infrastructure Layer Tests', () => {
  let firebaseServiceInstance: FirebaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    firebaseServiceInstance = new FirebaseService();
  });

  describe('Device Token DB Registration Checks', () => {
    it('should upsert registered tokens successfully', async () => {
      prisma.deviceToken.upsert.mockResolvedValue({ id: 'tok-1', token: 'fcm-token-123', userId: 'usr-1' });

      await firebaseServiceInstance.registerDeviceToken('usr-1', 'fcm-token-123');

      expect(prisma.deviceToken.upsert).toHaveBeenCalledWith({
        where: { token: 'fcm-token-123' },
        update: { userId: 'usr-1' },
        create: { token: 'fcm-token-123', userId: 'usr-1' },
      });
    });

    it('should throw BadRequestError on empty parameters during registration', async () => {
      await expect(
        firebaseServiceInstance.registerDeviceToken('', 'token-xyz'),
      ).rejects.toThrow(BadRequestError);

      await expect(
        firebaseServiceInstance.registerDeviceToken('usr-xyz', ''),
      ).rejects.toThrow(BadRequestError);
    });

    it('should delete token records on de-registration', async () => {
      prisma.deviceToken.deleteMany.mockResolvedValue({ count: 1 });

      await firebaseServiceInstance.deregisterDeviceToken('fcm-token-123');

      expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'fcm-token-123' },
      });
    });

    it('should throw BadRequestError on empty parameter during de-registration', async () => {
      await expect(firebaseServiceInstance.deregisterDeviceToken('')).rejects.toThrow(BadRequestError);
    });
  });

  describe('Notification Dispatch & Template Builders', () => {
    it('should output correctly formatted emergency title and body elements', () => {
      const payload = NotificationTemplates.EMERGENCY_ALERT('O_NEG', 'General Hospital', 5);
      expect(payload.title).toContain('O_NEG');
      expect(payload.body).toContain('5 units');
      expect(payload.body).toContain('General Hospital');
    });

    it('should query registered tokens, log history and call FCM messaging send', async () => {
      // Configure non-mock mode to verify messaging interactions
      (firebaseServiceInstance as any).isMockMode = false;

      // Mock user has 1 active token
      prisma.deviceToken.findMany.mockResolvedValue([{ token: 'active-fcm-token' }]);
      prisma.notification.create.mockResolvedValue({ id: 'notif-1' });
      mockSend.mockResolvedValue('msg-id-123');

      await firebaseServiceInstance.sendPushNotification(
        'usr-1',
        'Alert Title',
        'Alert Body',
        NotificationType.EMERGENCY_ALERT,
      );

      // Verify db checks log
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'usr-1',
          title: 'Alert Title',
          message: 'Alert Body',
          type: NotificationType.EMERGENCY_ALERT,
        },
      });

      // Verify FCM send parameters
      expect(mockSend).toHaveBeenCalledWith({
        token: 'active-fcm-token',
        notification: { title: 'Alert Title', body: 'Alert Body' },
        data: {},
      });
    });

    it('should record notifications in history but skip messaging if no token is found', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([]);
      prisma.notification.create.mockResolvedValue({ id: 'notif-2' });

      await firebaseServiceInstance.sendPushNotification(
        'usr-1',
        'Title Only',
        'Body Only',
        NotificationType.DONATION_REMINDER,
      );

      expect(prisma.notification.create).toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('FCM Retry Queues', () => {
    it('should schedule failed dispatches to retry queue', async () => {
      (firebaseServiceInstance as any).isMockMode = false;
      prisma.deviceToken.findMany.mockResolvedValue([{ token: 'failing-token' }]);
      
      // Force send to reject
      mockSend.mockRejectedValueOnce(new Error('FCM Service Offline'));

      await firebaseServiceInstance.sendPushNotification(
        'usr-1',
        'Fail Alert',
        'Fail Body',
        NotificationType.REQUEST_UPDATE,
      );

      // Verify item queued inside retryQueue array
      const queue = (firebaseServiceInstance as any).retryQueue;
      expect(queue.length).toBe(1);
      expect(queue[0].token).toBe('failing-token');
      expect(queue[0].attempts).toBe(1);
    });
  });
});
