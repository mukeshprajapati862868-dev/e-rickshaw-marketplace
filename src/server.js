const app = require('./app');
const connectDB = require('./config/database');
const config = require('./config');
const logger = require('./utils/logger');
const { warmEmail } = require('./services/emailService');

const start = async () => {
  await connectDB();
  await warmEmail();

  const server = app.listen(config.port, () => {
    logger.info(`e-riksha API running in ${config.env} mode on port ${config.port}`);
  });

  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err.message);
    server.close(() => process.exit(1));
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully.');
    server.close(() => process.exit(0));
  });
};

start();
