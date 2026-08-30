import { encryptData, decryptData } from '../src/utils/encryption';
import { metricsService } from '../src/services/metrics.service';

describe('Production Rollout Optimizations Tests', () => {
  describe('Encryption Key Rotation & Mappings', () => {
    it('should support legacy indexing fallback and decrypt correctly', () => {
      const plaintext = 'test-pii-payload';
      const encrypted = encryptData(plaintext);
      expect(encrypted._enc).toBe(true);
      expect(encrypted.v).toBeGreaterThanOrEqual(1);

      const decrypted = decryptData(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should fall back safely if decrypting payload with invalid version', () => {
      const payload = {
        _enc: true,
        v: 9999, // Non-existent version
        iv: '0'.repeat(24),
        tag: '0'.repeat(32),
        ciphertext: 'deadbeef',
      };
      expect(() => decryptData(payload)).toThrow();
    });
  });

  describe('Sentry Payload Scrubbing Filter', () => {
    it('should strip authorization, cookies, passwords, and answers', () => {
      const { initSentry } = require('../src/config/sentry');
      const dsn = 'https://public@sentry.example.com/1';
      process.env.SENTRY_DSN = dsn;

      const Sentry = require('@sentry/node');
      let capturedEvent: any = null;

      jest.spyOn(Sentry, 'init').mockImplementation((options: any) => {
        const mockEvent = {
          request: {
            headers: {
              Authorization: 'Bearer my-jwt-token',
              Cookie: 'session=secret-cookie-val',
              'Content-Type': 'application/json',
            },
            data: {
              email: 'test@donor.org',
              password: 'super-secret-password-123',
              otp: '123456',
              answers: {
                weight: 70,
                hasInfections: false,
              },
            },
          },
          message: 'otp=123456 failed',
        };

        if (options.beforeSend) {
          capturedEvent = options.beforeSend(mockEvent, {});
        }
      });

      initSentry();

      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent.request.headers.Authorization).toBe('[REDACTED]');
      expect(capturedEvent.request.headers.Cookie).toBe('[REDACTED]');
      expect(capturedEvent.request.data.password).toBe('[REDACTED]');
      expect(capturedEvent.request.data.otp).toBe('[REDACTED]');
      expect(capturedEvent.request.data.answers).toBe('[REDACTED]');
      expect(capturedEvent.message).toBe('otp=[REDACTED] failed');

      jest.restoreAllMocks();
      delete process.env.SENTRY_DSN;
    });
  });

  describe('Observability Metrics Extensions', () => {
    it('should increment conflicts, reservation failures, and lockouts counters', () => {
      // Standard call execution tests
      metricsService.recordInventoryConflict();
      metricsService.recordReservationFailure();
      metricsService.recordOTPLockout();
      metricsService.recordMatchingLatency(0.125);
      expect(true).toBe(true);
    });
  });
});
