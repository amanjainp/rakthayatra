import Redis from 'ioredis';
import { env } from '../config/env';
import logger from '../config/logger';
import { InternalServerError } from '../errors/app-error';

export class RedisService {
  private client: Redis | null = null;
  private isMockMode = false;
  private mockStore = new Map<string, { value: string; expiresAt: number | null }>();

  constructor() {
    const redisUrl = env.REDIS_URL || '';

    if (!redisUrl) {
      logger.warn('REDIS_URL not configured. RedisService is running in MOCK mode.');
      this.isMockMode = true;
    } else {
      try {
        this.client = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy(times) {
            // Reconnect backoff strategy
            const delay = Math.min(times * 100, 3000);
            return delay;
          },
        });

        this.client.on('connect', () => {
          logger.info('Redis connection pool connected successfully.');
        });

        this.client.on('error', (err) => {
          logger.error(`Redis connection failure: ${err.message}`);
        });
      } catch (error: any) {
        logger.error(`Failed to construct Redis Client instance: ${error.message}`);
        this.isMockMode = true;
      }
    }
  }

  public getMockMode(): boolean {
    return this.isMockMode;
  }

  /**
   * Pings the server to evaluate connection status.
   */
  async healthCheck(): Promise<boolean> {
    if (this.isMockMode) {
      return true;
    }
    try {
      const response = await this.client!.ping();
      return response === 'PONG';
    } catch (error) {
      return false;
    }
  }

  /**
   * Retrieves value linked to key.
   */
  async get(key: string): Promise<string | null> {
    if (this.isMockMode) {
      const record = this.mockStore.get(key);
      if (!record) return null;
      if (record.expiresAt && Date.now() > record.expiresAt) {
        this.mockStore.delete(key);
        return null;
      }
      return record.value;
    }

    try {
      return await this.client!.get(key);
    } catch (error: any) {
      logger.error(`Redis GET error for key "${key}": ${error.message}`);
      throw new InternalServerError('Failed to fetch item from cache.');
    }
  }

  /**
   * Saves key-value pair with an optional TTL (in seconds).
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.isMockMode) {
      const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
      this.mockStore.set(key, { value, expiresAt });
      return;
    }

    try {
      if (ttlSeconds) {
        await this.client!.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client!.set(key, value);
      }
    } catch (error: any) {
      logger.error(`Redis SET error for key "${key}": ${error.message}`);
      throw new InternalServerError('Failed to save item to cache.');
    }
  }

  /**
   * Deletes a key from the cache.
   */
  async del(key: string): Promise<void> {
    if (this.isMockMode) {
      this.mockStore.delete(key);
      return;
    }

    try {
      await this.client!.del(key);
    } catch (error: any) {
      logger.error(`Redis DEL error for key "${key}": ${error.message}`);
      throw new InternalServerError('Failed to remove item from cache.');
    }
  }

  /**
   * Clears all cache records.
   */
  async flushAll(): Promise<void> {
    if (this.isMockMode) {
      this.mockStore.clear();
      return;
    }
    try {
      await this.client!.flushall();
    } catch (error: any) {
      logger.error(`Redis FLUSHALL error: ${error.message}`);
      throw new InternalServerError('Failed to clear database cache.');
    }
  }

  // ==========================================
  // UTILITY CACHE WRAPPERS
  // ==========================================

  // 1. Session Cache: key pattern -> session:<token>
  async setSession(token: string, sessionData: string, ttlSeconds = 86400): Promise<void> {
    await this.set(`session:${token}`, sessionData, ttlSeconds);
  }

  async getSession(token: string): Promise<string | null> {
    return this.get(`session:${token}`);
  }

  // 2. OTP Cache: key pattern -> otp:<email>
  async setOTP(email: string, otp: string, ttlSeconds = 300): Promise<void> {
    await this.set(`otp:${email}`, otp, ttlSeconds);
  }

  async getOTP(email: string): Promise<string | null> {
    return this.get(`otp:${email}`);
  }

  // 3. Maps Cache: key pattern -> maps:<hash>
  async setMaps(hashKey: string, payload: string, ttlSeconds = 86400): Promise<void> {
    await this.set(`maps:${hashKey}`, payload, ttlSeconds);
  }

  async getMaps(hashKey: string): Promise<string | null> {
    return this.get(`maps:${hashKey}`);
  }

  // 4. Inventory Cache: key pattern -> inventory:<bankId>
  async setInventory(bankId: string, inventoryData: string, ttlSeconds = 3600): Promise<void> {
    await this.set(`inventory:${bankId}`, inventoryData, ttlSeconds);
  }

  async getInventory(bankId: string): Promise<string | null> {
    return this.get(`inventory:${bankId}`);
  }

  // 5. Rate Limit Cache: key pattern -> rate:<ip>:<route>
  async incrementRateLimit(key: string, ttlSeconds = 60): Promise<number> {
    const fullKey = `rate:${key}`;

    if (this.isMockMode) {
      const record = this.mockStore.get(fullKey);
      let count = 1;
      if (record && (!record.expiresAt || Date.now() < record.expiresAt)) {
        count = parseInt(record.value, 10) + 1;
      }
      const expiresAt = record?.expiresAt || (Date.now() + ttlSeconds * 1000);
      this.mockStore.set(fullKey, { value: count.toString(), expiresAt });
      return count;
    }

    try {
      const result = await this.client!.multi()
        .incr(fullKey)
        .expire(fullKey, ttlSeconds)
        .exec();

      if (!result || !result[0] || result[0][0]) {
        throw new Error('Transaction execution failed.');
      }
      return result[0][1] as number;
    } catch (error: any) {
      logger.error(`Redis INCR rate limit error for key "${fullKey}": ${error.message}`);
      throw new InternalServerError('Failed to update rate limits in cache.');
    }
  }

  async getRateLimit(key: string): Promise<number | null> {
    const value = await this.get(`rate:${key}`);
    return value ? parseInt(value, 10) : null;
  }
}

export const redisService = new RedisService();
