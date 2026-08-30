import * as Sentry from '@sentry/node';
import logger from './logger';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('SENTRY_DSN not configured. Sentry is running in offline mock mode.');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    beforeSend(event) {
      // 1. Scrub sensitive headers/cookies in request
      if (event.request) {
        if (event.request.headers) {
          const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie'];
          for (const key of Object.keys(event.request.headers)) {
            if (sensitiveHeaders.includes(key.toLowerCase())) {
              event.request.headers[key] = '[REDACTED]';
            }
          }
        }

        // 2. Scrub sensitive properties in request body / context data
        if (event.request.data) {
          try {
            let data = event.request.data;
            if (typeof data === 'string') {
              data = JSON.parse(data);
            }
            if (typeof data === 'object' && data !== null) {
              const redactSensitive = (obj: any) => {
                for (const key of Object.keys(obj)) {
                  if (['password', 'token', 'otp', 'answers'].includes(key.toLowerCase())) {
                    obj[key] = '[REDACTED]';
                  } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    redactSensitive(obj[key]);
                  }
                }
              };
              redactSensitive(data);
              event.request.data = data;
            }
          } catch {
            if (/password|token|otp|answers/i.test(JSON.stringify(event.request.data))) {
              event.request.data = '[REDACTED_SENSITIVE_DATA]';
            }
          }
        }
      }

      // 3. Scrub message parameters
      if (event.message) {
        event.message = event.message.replace(/(password|token|otp|answers)=[^&\s]+/gi, '$1=[REDACTED]');
      }

      return event;
    },
  });

  logger.info('Sentry Application Error Monitoring initialized successfully.');
}

export { Sentry };
