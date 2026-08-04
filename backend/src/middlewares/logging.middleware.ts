import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';

export const logContext = new AsyncLocalStorage<Map<string, string>>();

export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  const requestId = crypto.randomUUID();

  const store = new Map<string, string>([
    ['requestId', requestId],
    ['correlationId', correlationId],
  ]);

  res.setHeader('x-request-id', requestId);
  res.setHeader('x-correlation-id', correlationId);

  logContext.run(store, () => {
    next();
  });
}
