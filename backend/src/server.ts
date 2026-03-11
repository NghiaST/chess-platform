import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { initSocket } from './config/socket';
import { logger } from './utils/logger';

const PORT = process.env.PORT ?? 4000;

// Create HTTP server (needed for Socket.IO)
const httpServer = createServer(app);

// Initialize Socket.IO (prepared for multiplayer Phase 5)
initSocket(httpServer);

httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`📡 Socket.IO ready for connections`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});
