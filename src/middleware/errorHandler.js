const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const config = require('../config');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';

  // Mongoose validation
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // Duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE';
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `${field} already exists`;
  }

  // Cast error
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid resource identifier';
  }

  if (statusCode >= 500) {
    logger.error(err.message, {
      stack: config.env === 'development' ? err.stack : undefined,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.warn(err.message, { code, path: req.path });
  }

  res.status(statusCode).json({
    success: false,
    code,
    message: statusCode === 500 && config.env === 'production' ? 'Internal server error' : message,
    ...(config.env === 'development' && statusCode === 500 ? { stack: err.stack } : {}),
  });
};

const notFound = (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND'));
};

module.exports = { errorHandler, notFound };
