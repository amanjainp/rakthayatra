import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metrics.service';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  metricsService.incrementActiveRequests();
  const startTime = process.hrtime();

  res.on('finish', () => {
    metricsService.decrementActiveRequests();
    
    // Calculate elapsed time in seconds
    const diff = process.hrtime(startTime);
    const durationSeconds = diff[0] + diff[1] / 1e9;

    // Use route path pattern if available (e.g. /api/requests/:id instead of raw path /api/requests/123-abc)
    const route = req.route ? req.route.path : req.path;

    metricsService.recordHttpRequest(req.method, route, res.statusCode, durationSeconds);
  });

  next();
}
