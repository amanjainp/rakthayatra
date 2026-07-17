import dotenv from 'dotenv';
import app from './app';
import logger from './config/logger';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle graceful shutdowns
const shutdown = () => {
  logger.info('Received shutdown signal, shutting down server gracefully...');
  server.close(() => {
    logger.info('Closed out remaining active connections, server terminated.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
