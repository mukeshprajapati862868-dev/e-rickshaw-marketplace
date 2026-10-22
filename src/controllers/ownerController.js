const OwnerProfile = require('../models/OwnerProfile');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const getProfile = asyncHandler(async (req, res) => {
  let profile = await OwnerProfile.findOne({ user: req.user._id }).populate('user', 'email role');
  if (!profile) {
    profile = await OwnerProfile.create({ user: req.user._id });
  }
  res.json({ success: true, data: profile });
});

const updateProfile = asyncHandler(async (req, res) => {
  const profile = await OwnerProfile.findOne({ user: req.user._id });
  if (!profile) throw new AppError('Profile not found', 404);

  const allowed = ['name', 'mobile', 'address', 'profilePhoto', 'bankDetails'];
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) profile[k] = req.body[k];
  });
  await profile.save();
  res.json({ success: true, data: profile });
});

module.exports = { getProfile, updateProfile };
