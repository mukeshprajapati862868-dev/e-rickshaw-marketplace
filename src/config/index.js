require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5000',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/e-rickshaw-marketplace',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me_32chars',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me_32chars',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    from: process.env.EMAIL_FROM || 'E-Rickshaw Rental <noreply@localhost>',
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
    resendApiKey: process.env.RESEND_API_KEY,
    sendgridApiKey: process.env.SENDGRID_API_KEY,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER || 'e-rickshaw',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  platform: {
    commissionPercent: parseFloat(process.env.PLATFORM_COMMISSION_PERCENT) || 8,
    otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5,
    otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
    otpRateLimitWindowMs: parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MS, 10) || 60000,
    otpRateLimitMax: parseInt(process.env.OTP_RATE_LIMIT_MAX, 10) || 3,
  },

  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173,http://localhost:8081,http://10.0.2.2:5000').split(',').map((o) => o.trim()),

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@erickshaw.com',
    password: process.env.ADMIN_PASSWORD || 'ChangeMeImmediately123!',
  },
};

module.exports = config;
