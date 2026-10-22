
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const driverRoutes = require('./routes/driverRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const addressRoutes = require('./routes/addressRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const merchantRoutes = require('./routes/merchantRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const customerRoutes = require('./routes/customerRoutes');

const app = express();

// Security
app.use(helmet());

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

// Preserve the original Razorpay webhook body.
// This MUST be registered before express.json().
app.use(
  '/api/payments/webhook',
  express.raw({ type: 'application/json', limit: '1mb' })
);

app.use(mongoSanitize());
app.use(compression());
app.use(cookieParser());

// Body parsers for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.env !== 'test') {
  app.use(
    morgan(config.env === 'production' ? 'combined' : 'dev', {
      stream: {
        write: (msg) => logger.info(msg.trim()),
      },
    })
  );
}

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', globalLimiter);

// Health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API map
app.get('/api', (req, res) => {
  res.json({
    name: 'e-riksha API',
    version: '1.0',
    endpoints: {
      auth: [
        'POST /api/auth/otp/request',
        'POST /api/auth/otp/verify',
        'POST /api/auth/refresh',
        'GET /api/auth/me',
      ],
      delivery: [
        'POST /api/delivery/estimate',
        'POST /api/delivery/bookings',
        'GET /api/delivery/bookings/my',
        'GET /api/delivery/bookings/:id',
        'GET /api/delivery/requests',
        'POST /api/delivery/requests/:id/accept',
        'PATCH /api/delivery/bookings/:id/status',
        'PATCH /api/delivery/driver/online',
        'POST /api/delivery/bookings/:id/generate-proof-otp',
        'POST /api/delivery/bookings/:id/verify-proof-otp',
      ],
      payments: [
        'POST /api/payments/create-order',
        'POST /api/payments/verify',
        'POST /api/payments/webhook',
      ],
      addresses: [
        'GET /api/addresses',
        'POST /api/addresses',
        'DELETE /api/addresses/:id',
      ],
      rewards: ['GET /api/rewards/my-week'],
      admin: [
        'GET /api/admin/dashboard',
        'GET /api/admin/deliveries',
        'GET /api/admin/users',
      ],
    },
  });
});
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'E-Rickshaw Marketplace API is running',
  });
});
// API routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/owners', ownerRoutes);
app.use('/api/admin', adminRoutes);

// paymentRoutes must have POST /webhook registered
// and must not require customer authentication for that route.
app.use('/api/payments', paymentRoutes);

app.use('/api/notifications', notificationRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/customers', customerRoutes);

// Error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
