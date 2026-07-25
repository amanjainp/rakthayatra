import { RedisService } from '../src/services/redis.service';

describe('RedisService Infrastructure Layer Tests', () => {
  let redisServiceInstance: RedisService;

  beforeEach(() => {
    redisServiceInstance = new RedisService();
  });

  describe('Cache Set, Get, and Delete controls', () => {
    it('should correctly set and get items from the cache', async () => {
      await redisServiceInstance.set('test-key', 'cached-value');
      const val = await redisServiceInstance.get('test-key');
      expect(val).toBe('cached-value');
    });

    it('should return null for non-existent cache keys', async () => {
      const val = await redisServiceInstance.get('missing-key');
      expect(val).toBeNull();
    });

    it('should delete keys from the cache', async () => {
      await redisServiceInstance.set('del-key', 'to-be-deleted');
      await redisServiceInstance.del('del-key');
      const val = await redisServiceInstance.get('del-key');
      expect(val).toBeNull();
    });

    it('should flush all records from the database cache', async () => {
      await redisServiceInstance.set('key-a', 'val-a');
      await redisServiceInstance.set('key-b', 'val-b');
      await redisServiceInstance.flushAll();

      expect(await redisServiceInstance.get('key-a')).toBeNull();
      expect(await redisServiceInstance.get('key-b')).toBeNull();
    });
  });

  describe('TTL Expiration Logic', () => {
    it('should expire keys after the specified TTL has elapsed', async () => {
      // Set key with a TTL of 1 second
      await redisServiceInstance.set('expire-key', 'soon-gone', 1);

      // Fast-forward mock clock or mock record manually to evaluate mock TTL expiration
      const store = (redisServiceInstance as any).mockStore;
      const record = store.get('expire-key');
      expect(record).toBeDefined();

      // Override expiration timestamp to verify expiration logic runs
      record.expiresAt = Date.now() - 1000;

      const expiredVal = await redisServiceInstance.get('expire-key');
      expect(expiredVal).toBeNull();
    });
  });

  describe('Rate Limiting Increment Checks', () => {
    it('should increment rate limit counters correctly', async () => {
      const limitKey = 'user-ip:127.0.0.1:login';
      const c1 = await redisServiceInstance.incrementRateLimit(limitKey, 10);
      expect(c1).toBe(1);

      const c2 = await redisServiceInstance.incrementRateLimit(limitKey, 10);
      expect(c2).toBe(2);

      const c3 = await redisServiceInstance.getRateLimit(limitKey);
      expect(c3).toBe(2);
    });
  });

  describe('Utility Caching Wrappers', () => {
    it('should save and get session records', async () => {
      await redisServiceInstance.setSession('session-token-xyz', JSON.stringify({ userId: 'usr-1' }));
      const session = await redisServiceInstance.getSession('session-token-xyz');
      expect(session).toContain('usr-1');
    });

    it('should save and get OTP records', async () => {
      await redisServiceInstance.setOTP('test@donor.org', '123456');
      const otp = await redisServiceInstance.getOTP('test@donor.org');
      expect(otp).toBe('123456');
    });

    it('should save and get geocode mapping logs', async () => {
      const mapCoords = JSON.stringify({ lat: 12.9, lng: 77.5 });
      await redisServiceInstance.setMaps('Yeshwanthpur', mapCoords);
      const coords = await redisServiceInstance.getMaps('Yeshwanthpur');
      expect(coords).toBe(mapCoords);
    });

    it('should save and get inventory cached states', async () => {
      const invPayload = JSON.stringify({ A_POS: 10, O_NEG: 5 });
      await redisServiceInstance.setInventory('bank-123', invPayload);
      const inventory = await redisServiceInstance.getInventory('bank-123');
      expect(inventory).toBe(invPayload);
    });
  });

  describe('Connection Health Checks', () => {
    it('should return true for health check', async () => {
      const healthy = await redisServiceInstance.healthCheck();
      expect(healthy).toBe(true);
    });
  });
});
