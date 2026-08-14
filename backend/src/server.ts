import dotenv from 'dotenv';
import app from './app';
import logger from './config/logger';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

// Only listen if not running in Vercel environment
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

export default app;
