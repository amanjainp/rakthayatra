import { redisService } from './redis.service';

class CacheService {
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await redisService.set(key, value, ttlSeconds);
  }

  async get(key: string): Promise<string | null> {
    return redisService.get(key);
  }

  async delete(key: string): Promise<void> {
    await redisService.del(key);
  }
}

export const cacheService = new CacheService();

