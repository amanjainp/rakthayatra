import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { redisService } from '../services/redis.service';
import { rabbitMQService } from '../services/rabbitmq.service';
import { env } from '../config/env';
import logger from '../config/logger';

const router = Router();
const prisma = new PrismaClient();

/**
 * Diagnostic Liveness probe - verifies process is running.
 * Do not connect to database or external dependencies here.
 */
router.get('/live', (_req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'LifeLink API Server',
    },
  });
});

/**
 * Readiness probe - verifies critical external dependencies.
 */
router.get('/ready', async (_req, res) => {
  let dbStatus = 'DOWN';
  let redisStatus = 'DOWN';
  let rabbitMQStatus = 'DOWN';

  // 1. Verify Postgres connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'UP';
  } catch (error: any) {
    logger.error(`Readiness Probe: Database connection failure: ${error.message}`);
  }

  // 2. Verify Redis cache connection
  try {
    const isRedisHealthy = await redisService.healthCheck();
    redisStatus = isRedisHealthy ? 'UP' : 'DOWN';
  } catch (error: any) {
    logger.error(`Readiness Probe: Redis healthcheck failed: ${error.message}`);
  }

  // 3. Verify RabbitMQ messaging broker connection
  try {
    const isRabbitMQHealthy = await rabbitMQService.healthCheck();
    rabbitMQStatus = isRabbitMQHealthy ? 'UP' : 'DOWN';
  } catch (error: any) {
    logger.error(`Readiness Probe: RabbitMQ healthcheck failed: ${error.message}`);
  }

  const isReady = dbStatus === 'UP' && redisStatus === 'UP' && rabbitMQStatus === 'UP';

  return res.status(isReady ? 200 : 503).json({
    success: isReady,
    data: {
      status: isReady ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
      db: dbStatus,
      redis: redisStatus,
      rabbitmq: rabbitMQStatus,
      environment: env.NODE_ENV,
    },
  });
});

/**
 * Backwards-compatibility root health check fallback
 */
router.get('/', async (_req, res) => {
  let dbStatus = 'UNKNOWN';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'UP';
  } catch (error: any) {
    logger.warn(`Health Check: Database connection probe failed: ${error.message}`);
    dbStatus = 'DOWN';
  }

  const memoryUsage = process.memoryUsage();
  const isHealthy = dbStatus === 'UP';

  return res.status(isHealthy ? 200 : 500).json({
    success: isHealthy,
    data: {
      status: isHealthy ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      service: 'Rakthayatra API Server',
      environment: env.NODE_ENV,
      uptime: process.uptime(),
      db: dbStatus,
      system: {
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        },
        nodeVersion: process.version,
        platform: process.platform,
      },
    },
  });
});

export default router;
