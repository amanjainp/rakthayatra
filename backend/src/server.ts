import dotenv from 'dotenv';
import app from './app';
import logger from './config/logger';

// Load environment variables
dotenv.config();

const PORT = Number(process.env.PORT) || 5000;

// Only listen if not running in Vercel environment
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT} (0.0.0.0)`);
  });
}

export default app;
