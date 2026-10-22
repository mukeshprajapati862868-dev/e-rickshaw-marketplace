const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');

const requestOTP = asyncHandler(async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress;
  const result = await authService.requestOTP({
    email: req.body.email,
    mobile: req.body.mobile,
    role: req.body.role,
    ipAddress: ip,
  });
  res.status(200).json({ success: true, data: result });
});

const verifyOTP = asyncHandler(async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress;
  const result = await authService.verifyOTP({
    email: req.body.email,
    mobile: req.body.mobile,
    otp: req.body.otp,
    role: req.body.role,
    ipAddress: ip,
  });
  res.status(200).json({ success: true, data: result });
});

const refreshToken = asyncHandler(async (req, res) => {
  const result = await authService.refreshAccessToken(req.body.refreshToken);
  res.status(200).json({ success: true, data: result });
});

const logout = asyncHandler(async (req, res) => {
  const result = await authService.logout(req.user._id, req.body.refreshToken);
  res.status(200).json({ success: true, data: result });
});

const me = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      id: req.user._id,
      email: req.user.email,
      mobile: req.user.mobile,
      role: req.user.role,
      name: req.user.name,
      isEmailVerified: req.user.isEmailVerified,
      isMobileVerified: req.user.isMobileVerified,
      language: req.user.language,
      lastLoginAt: req.user.lastLoginAt,
    },
  });
});

module.exports = {
  requestOTP,
  verifyOTP,
  refreshToken,
  logout,
  me,
};
