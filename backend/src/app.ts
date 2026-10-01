import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import logger from './config/logger';
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';
import inventoryRoutes from './routes/inventory.routes';
import donationRoutes from './routes/donation.routes';
import bloodRequestRoutes from './routes/blood-request.routes';
import medicalEligibilityRoutes from './routes/medical-eligibility.routes';
import donationCampRoutes from './routes/donation-camp.routes';
import { metricsMiddleware } from './middlewares/metrics.middleware';
import metricsRoutes from './routes/metrics.routes';
import { loggingMiddleware } from './middlewares/logging.middleware';
import { renderApiLandingPage } from './views/landing-page';

const app = express();

// Apply Logging context middleware first to set request/correlation IDs
app.use(loggingMiddleware);

// Apply Metrics Middleware to trace HTTP timings
app.use(metricsMiddleware);

// Security Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Increased limit for development/testing to avoid lockouts
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again after 15 minutes.',
    },
  },
});
app.use(globalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/requests', bloodRequestRoutes);
app.use('/api/eligibility', medicalEligibilityRoutes);
app.use('/api/camps', donationCampRoutes);

// Root API Welcome / Status probe
const rootStatusHandler = (req: Request, res: Response) => {
  // If request comes from a browser, render rich interactive landing hub
  if (req.accepts('html') && req.query.json !== 'true') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderApiLandingPage());
  }

  return res.status(200).json({
    success: true,
    message: 'Rakthayatra (LifeLink) Backend API is running successfully.',
    status: 'UP',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      healthLive: '/health/live',
      healthReady: '/health/ready',
      metrics: '/metrics',
      auth: '/api/auth',
      inventory: '/api/inventory',
      donations: '/api/donations',
      requests: '/api/requests',
      eligibility: '/api/eligibility',
      camps: '/api/camps',
    },
  });
};

app.get('/', rootStatusHandler);
app.get('/api', rootStatusHandler);

// Health Check API (available at /health and /api/health)
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// Metrics Endpoint Route
app.use('/metrics', metricsRoutes);

// 404 Route Catch-all
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.url}`,
    },
  });
});

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled Exception occurred: %O', err);

  // Capture exception in Sentry
  try {
    const { Sentry } = require('./config/sentry');
    Sentry.captureException(err);
  } catch (se) {
    logger.error('Sentry capture exception failed: %O', se);
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected database or server error occurred.',
    },
  });
});

// Initialize Sentry at server startup
try {
  const { initSentry } = require('./config/sentry');
  initSentry();
} catch (e) {
  logger.error('Failed to initialize Sentry: %O', e);
}

export default app;
