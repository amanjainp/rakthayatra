import { Router, Request, Response } from 'express';
import { metricsService } from '../services/metrics.service';
import logger from '../config/logger';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const metricsContent = await metricsService.getMetrics();
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metricsContent);
  } catch (error: any) {
    logger.error(`Failed to retrieve prometheus metrics registry: ${error.message}`);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate metrics log registries.',
      },
    });
  }
});

export default router;
