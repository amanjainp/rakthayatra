import winston from 'winston';
import path from 'path';
import { env } from './env';
import { logContext } from '../middlewares/logging.middleware';

// 1. Sensitive Data Masking Helper
function maskSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(maskSensitiveData);
  }

  const masked: any = {};
  const sensitiveKeys = ['password', 'token', 'secret', 'otp', 'accesstoken', 'refreshtoken', 'passwordhash', 'credentials'];

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const keyLower = key.toLowerCase();
    if (sensitiveKeys.some(s => keyLower.includes(s))) {
      masked[key] = '[MASKED]';
    } else if (typeof val === 'object') {
      masked[key] = maskSensitiveData(val);
    } else {
      masked[key] = val;
    }
  }
  return masked;
}

// 2. Custom Winston Formats
const contextFormat = winston.format((info) => {
  const store = logContext.getStore();
  if (store) {
    info.requestId = store.get('requestId');
    info.correlationId = store.get('correlationId');
  }
  return info;
});

const maskingFormat = winston.format((info) => {
  const maskedInfo = maskSensitiveData(info);
  // Re-bind masked properties back to the info object
  Object.assign(info, maskedInfo);
  return info;
});

const logFormat = winston.format.combine(
  contextFormat(),
  maskingFormat(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'backend-api' },
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
    }),
  ],
});

if (env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf((info) => {
          const { timestamp, level, message, stack, requestId, correlationId } = info;
          const reqId = typeof requestId === 'string' ? requestId : '';
          const corrId = typeof correlationId === 'string' ? correlationId : '';
          const reqContext = reqId ? ` [ReqID: ${reqId.substring(0, 8)} | CorrID: ${corrId.substring(0, 8)}]` : '';
          return `[${timestamp}] ${level}${reqContext}: ${message}${stack ? `\n${stack}` : ''}`;
        })
      ),
    })
  );
}

export default logger;
