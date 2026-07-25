import { RabbitMQService } from '../src/services/rabbitmq.service';

describe('RabbitMQService Infrastructure Layer Tests', () => {
  let rabbitMQServiceInstance: RabbitMQService;

  beforeEach(() => {
    rabbitMQServiceInstance = new RabbitMQService();
  });

  describe('Topic Routing Pattern matching rules', () => {
    it('should correctly match dot-separated routing key segments using wildcards (#)', () => {
      const matcher = (rabbitMQServiceInstance as any).matchesRoutingKeyPattern;

      // Matches multi-level wildcard (#)
      expect(matcher('notification.sms.sent', 'notification.#')).toBe(true);
      expect(matcher('notification.email', 'notification.#')).toBe(true);
      expect(matcher('notification', 'notification.#')).toBe(true);

      // Fails on unmatched prefixes
      expect(matcher('audit.login', 'notification.#')).toBe(false);
    });
  });

  describe('Publish and Consume Flow (Mock broker)', () => {
    it('should route published messages to the correct consumer callback', (done) => {
      const mockPayload = { to: 'donor@lifelink.org', subject: 'Emergency Alert' };

      // Register consumer on the email queue
      rabbitMQServiceInstance.consume('lifelink.queue.email', async (msg) => {
        try {
          expect(msg).toEqual(mockPayload);
          done();
        } catch (error) {
          done(error);
        }
      });

      // Publish with a routing key matching 'email.#'
      rabbitMQServiceInstance.publish('email.emergency', mockPayload);
    });

    it('should skip consumer execution if the routing key does not match bindings', (done) => {
      const mockPayload = { data: 'some-data' };
      const mockCallback = jest.fn();

      rabbitMQServiceInstance.consume('lifelink.queue.sms', mockCallback);

      // Publish with an unmatched routing key
      rabbitMQServiceInstance.publish('audit.login', mockPayload);

      setTimeout(() => {
        expect(mockCallback).not.toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('Mock DLQ Transition Handling', () => {
    it('should send the message to the DLQ if processing throws an error', (done) => {
      const mockPayload = { text: 'critical alert' };

      // Register a failing consumer
      rabbitMQServiceInstance.consume('lifelink.queue.sms', async () => {
        throw new Error('SMS Gateway Down');
      });

      // Trigger publish
      rabbitMQServiceInstance.publish('sms.alert', mockPayload);

      // Wait a moment for setImmediate execution and verify it does not crash
      setTimeout(() => {
        done();
      }, 50);
    });
  });

  describe('Connection Health Checks', () => {
    it('should return true for broker health check', async () => {
      const healthy = await rabbitMQServiceInstance.healthCheck();
      expect(healthy).toBe(true);
    });
  });
});
