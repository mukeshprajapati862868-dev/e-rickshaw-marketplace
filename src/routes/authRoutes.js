const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const {
  validateRequestOTP,
  validateVerifyOTP,
  validateRefreshToken,
} = require('../validators/authValidators');
const { authenticate } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

const otpLimiter = rateLimit({
  windowMs: config.platform.otpRateLimitWindowMs,
  max: config.platform.otpRateLimitMax,
  message: {
    success: false,
    code: 'OTP_RATE_LIMIT',
    message: 'Too many OTP requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/otp/request', otpLimiter, validateRequestOTP, authController.requestOTP);
router.post('/otp/verify', validateVerifyOTP, authController.verifyOTP);
router.post('/refresh', validateRefreshToken, authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

module.exports = router;
