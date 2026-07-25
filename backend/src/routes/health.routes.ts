import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import logger from '../config/logger';

const router = Router();
const prisma = new PrismaClient();

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

  return res.status(isHealthy ? 200 : 200).json({ // Return 200 to allow diagnostic inspection
    success: true,
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
