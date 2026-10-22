const User = require('../models/User');
const OTP = require('../models/OTP');
const DriverProfile = require('../models/DriverProfile');
const OwnerProfile = require('../models/OwnerProfile');
const CustomerProfile = require('../models/CustomerProfile');
const { generateOTP } = require('../utils/helpers');
const { sendOTPEmail } = require('./emailService');
const {
  issueTokens,
  revokeRefreshToken,
  verifyRefreshToken,
} = require('./tokenService');
const config = require('../config');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const isEmail = (v) =>
  /^\S+@\S+\.\S+$/.test(String(v || '').trim());

const isMobile = (v) =>
  /^[6-9]\d{9}$/.test(
    String(v || '').replace(/\D/g, '').slice(-10)
  );

const normalizeMobile = (v) =>
  String(v || '').replace(/\D/g, '').slice(-10);

/**
 * Send OTP via SMS.
 * Development mode logs OTP to the console.
 * Configure an SMS provider before production use.
 */
const sendOTPSMS = async (mobile, otp) => {
  console.log('\n========================================');
  console.log('  e-riksha OTP SMS (DEV / configure SMS provider)');
  console.log('========================================');
  console.log(`  To   : +91${mobile}`);
  console.log(`  OTP  : ${otp}`);
  console.log('  Valid: 5 minutes');
  console.log('========================================\n');

  logger.info(`OTP SMS queued for +91${mobile}`);
  return true;
};

/**
 * Request OTP for email OR mobile.
 * Body: { email?, mobile?, role? }
 */
const requestOTP = async ({
  email,
  mobile,
  role,
  ipAddress,
}) => {
  let identifier;
  let channel;

  if (mobile) {
    const normalized = normalizeMobile(mobile);

    if (!isMobile(normalized)) {
      throw new AppError(
        'Valid 10-digit Indian mobile required',
        400,
        'INVALID_MOBILE'
      );
    }

    identifier = normalized;
    channel = 'MOBILE';
  } else if (email) {
    const normalizedEmail = String(email).trim().toLowerCase();

    if (!isEmail(normalizedEmail)) {
      throw new AppError(
        'Valid email is required',
        400,
        'INVALID_EMAIL'
      );
    }

    identifier = normalizedEmail;
    channel = 'EMAIL';
  } else {
    throw new AppError(
      'Email or mobile is required',
      400,
      'MISSING_IDENTIFIER'
    );
  }

  const query =
    channel === 'EMAIL'
      ? { email: identifier }
      : { mobile: identifier };

  const existingUser = await User.findOne(query);

  // Allowed roles for normal registration.
  // ADMIN must be created/assigned by a trusted administrator.
  const allowedNewUserRoles = [
    'CUSTOMER',
    'DRIVER',
    'OWNER',
  ];

  if (!existingUser) {
    if (role && !allowedNewUserRoles.includes(role)) {
      throw new AppError(
        'Invalid role. Use CUSTOMER, DRIVER or OWNER',
        400,
        'INVALID_ROLE'
      );
    }
  } else {
    // Do not allow an existing account to request OTP
    // for a different role by sending a role in the request.
    if (
      role &&
      role !== existingUser.role
    ) {
      throw new AppError(
        'Requested role does not match this account',
        403,
        'ROLE_MISMATCH'
      );
    }

    if (existingUser.isBlocked) {
      throw new AppError(
        'Account blocked. Contact support.',
        403,
        'ACCOUNT_BLOCKED'
      );
    }

    if (!existingUser.isActive) {
      throw new AppError(
        'Account inactive',
        403,
        'ACCOUNT_INACTIVE'
      );
    }
  }

  const recent = await OTP.findOne({
    identifier,
    purpose: 'LOGIN',
    createdAt: {
      $gte: new Date(Date.now() - 20000),
    },
  }).sort({ createdAt: -1 });

  if (recent) {
    throw new AppError(
      'Please wait a few seconds before requesting another OTP',
      429,
      'OTP_RATE_LIMIT'
    );
  }

  const plainOtp = generateOTP();

  await OTP.createOTP(
    identifier,
    plainOtp,
    channel,
    'LOGIN',
    ipAddress,
    config.platform.otpExpiryMinutes
  );

  if (channel === 'EMAIL') {
    await sendOTPEmail(identifier, plainOtp);
  } else {
    await sendOTPSMS(identifier, plainOtp);
  }

  logger.info(
    `OTP requested via ${channel} for ${identifier}`
  );

  return {
    message:
      channel === 'EMAIL'
        ? 'OTP sent to your email'
        : 'OTP sent to your mobile',
    channel,
    identifier:
      channel === 'EMAIL'
        ? identifier
        : `******${identifier.slice(-4)}`,
    expiresInMinutes: config.platform.otpExpiryMinutes,
    isNewUser: !existingUser,
  };
};

/**
 * Verify OTP and issue JWT.
 */
const verifyOTP = async ({
  email,
  mobile,
  otp,
  role,
  ipAddress,
}) => {
  if (!otp) {
    throw new AppError(
      'OTP is required',
      400,
      'MISSING_FIELDS'
    );
  }

  let identifier;
  let channel;

  if (mobile) {
    identifier = normalizeMobile(mobile);

    if (!isMobile(identifier)) {
      throw new AppError(
        'Valid 10-digit Indian mobile required',
        400,
        'INVALID_MOBILE'
      );
    }

    channel = 'MOBILE';
  } else if (email) {
    identifier = String(email).trim().toLowerCase();

    if (!isEmail(identifier)) {
      throw new AppError(
        'Valid email is required',
        400,
        'INVALID_EMAIL'
      );
    }

    channel = 'EMAIL';
  } else {
    throw new AppError(
      'Email or mobile is required',
      400,
      'MISSING_IDENTIFIER'
    );
  }

  const query =
    channel === 'EMAIL'
      ? { email: identifier }
      : { mobile: identifier };

  // Find account before accepting the OTP.
  // An existing ADMIN account is allowed to log in using OTP.
  // A new account cannot self-register as ADMIN.
  let user = await User.findOne(query);

  if (user) {
    if (user.isBlocked) {
      throw new AppError(
        'Account blocked. Contact support.',
        403,
        'ACCOUNT_BLOCKED'
      );
    }

    if (!user.isActive) {
      throw new AppError(
        'Account inactive',
        403,
        'ACCOUNT_INACTIVE'
      );
    }

    // Prevent the login request from changing an existing
    // account's role, including CUSTOMER to ADMIN.
    if (role && role !== user.role) {
      throw new AppError(
        'Requested role does not match this account',
        403,
        'ROLE_MISMATCH'
      );
    }
  } else {
    const newRole = role || 'CUSTOMER';

    if (
      !['CUSTOMER', 'DRIVER', 'OWNER'].includes(newRole)
    ) {
      throw new AppError(
        'Role required for new users (CUSTOMER / DRIVER / OWNER)',
        400,
        'ROLE_REQUIRED'
      );
    }
  }

  const otpRecord = await OTP.findOne({
    identifier,
    purpose: 'LOGIN',
    used: false,
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new AppError(
      'No valid OTP found. Please request a new one.',
      400,
      'OTP_NOT_FOUND'
    );
  }

  const result = await otpRecord.verify(
    String(otp).trim()
  );

  if (!result.valid) {
    const messages = {
      OTP_ALREADY_USED: 'OTP already used. Request a new one.',
      OTP_EXPIRED: 'OTP has expired. Request a new one.',
      MAX_ATTEMPTS: 'Maximum attempts exceeded. Request a new OTP.',
      INVALID_OTP: 'Invalid OTP. Please try again.',
    };

    throw new AppError(
      messages[result.reason] || 'OTP verification failed',
      400,
      result.reason
    );
  }

  // Create only normal user roles.
  // ADMIN accounts must already exist in the database.
  if (!user) {
    const newRole = role || 'CUSTOMER';

    const userData = {
      role: newRole,
      isEmailVerified: channel === 'EMAIL',
      isMobileVerified: channel === 'MOBILE',
      lastLoginAt: new Date(),
    };

    if (channel === 'EMAIL') {
      userData.email = identifier;
    } else {
      userData.mobile = identifier;
    }

    user = await User.create(userData);

    if (newRole === 'CUSTOMER') {
      await CustomerProfile.create({
        user: user._id,
        mobile: user.mobile,
      });
    } else if (newRole === 'DRIVER') {
      await DriverProfile.create({
        user: user._id,
        mobile: user.mobile,
      });
    } else if (newRole === 'OWNER') {
      await OwnerProfile.create({
        user: user._id,
      });
    }

    logger.info(
      `New ${newRole} account: ${identifier}`
    );
  } else {
    if (user.isBlocked) {
      throw new AppError(
        'Account blocked. Contact support.',
        403,
        'ACCOUNT_BLOCKED'
      );
    }

    if (!user.isActive) {
      throw new AppError(
        'Account inactive',
        403,
        'ACCOUNT_INACTIVE'
      );
    }

    if (channel === 'EMAIL') {
      user.isEmailVerified = true;
    }

    if (channel === 'MOBILE') {
      user.isMobileVerified = true;
    }

    user.lastLoginAt = new Date();
    await user.save();
  }

  const tokens = await issueTokens(user);

  return {
    user: {
      id: user._id,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      name: user.name,
      isEmailVerified: user.isEmailVerified,
      isMobileVerified: user.isMobileVerified,
      language: user.language,
    },
    ...tokens,
  };
};

/**
 * Refresh access token.
 */
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError(
      'Refresh token required',
      400,
      'MISSING_TOKEN'
    );
  }

  const decoded = verifyRefreshToken(refreshToken);
  const user = await User.findById(decoded.sub);

  if (!user) {
    throw new AppError(
      'User not found',
      401,
      'USER_NOT_FOUND'
    );
  }

  const stored = (user.refreshTokens || []).find(
    (token) =>
      token.token === refreshToken &&
      token.expiresAt > new Date()
  );

  if (!stored) {
    throw new AppError(
      'Refresh token revoked or expired',
      401,
      'INVALID_REFRESH'
    );
  }

  if (user.isBlocked || !user.isActive) {
    throw new AppError(
      'Account restricted',
      403,
      'ACCOUNT_RESTRICTED'
    );
  }

  return issueTokens(user);
};

/**
 * Logout.
 */
const logout = async (userId, refreshToken) => {
  if (refreshToken) {
    await revokeRefreshToken(userId, refreshToken);
  }

  return {
    message: 'Logged out successfully',
  };
};

module.exports = {
  requestOTP,
  verifyOTP,
  refreshAccessToken,
  logout,
  sendOTPSMS,
};
