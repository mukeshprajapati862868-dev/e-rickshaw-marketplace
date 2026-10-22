const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'e-rickshaw-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length && meta.service ? '' : JSON.stringify(meta);
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

// Never log secrets
const sensitiveKeys = ['password', 'otp', 'token', 'secret', 'authorization', 'aadhaar', 'pan', 'bank'];

logger.sanitize = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = { ...obj };
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      clone[key] = '[REDACTED]';
    }
  }
  return clone;
};

module.exports = logger;
