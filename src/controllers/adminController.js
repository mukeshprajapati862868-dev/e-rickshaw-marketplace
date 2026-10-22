const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
// const Booking = require('../models/Booking');
// const Lease = require('../models/Lease');
const Commission = require('../models/Commission');
const Complaint = require('../models/Complaint');
const DeliveryBooking = require('../models/DeliveryBooking');
const FareRule = require('../models/FareRule');
const Reward = require('../models/Reward');
const Payment = require('../models/Payment');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const config = require('../config');

const dashboard = asyncHandler(async (req, res) => {
  const [
    totalCustomers,
    totalDrivers,
    totalVehicles,
    verifiedVehicles,
    activeLeases,
    pendingKycVehicles,
    openComplaints,
    totalDeliveries,
    completedDeliveries,
    searchingDeliveries,
    paidPayments,
  ] = await Promise.all([
    User.countDocuments({ role: 'CUSTOMER' }),
    User.countDocuments({ role: 'DRIVER' }),
    Vehicle.countDocuments(),
    Vehicle.countDocuments({ 'verification.status': 'APPROVED' }),
    Lease.countDocuments({ status: 'ACTIVE' }),
    Vehicle.countDocuments({ 'verification.status': 'PENDING' }),
    Complaint.countDocuments({ status: { $in: ['OPEN', 'INVESTIGATING'] } }),
    DeliveryBooking.countDocuments(),
    DeliveryBooking.countDocuments({ status: 'DELIVERED' }),
    DeliveryBooking.countDocuments({ status: 'SEARCHING' }),
    Payment.countDocuments({ status: 'SUCCESS' }),
  ]);

  const revenueAgg = await DeliveryBooking.aggregate([
    { $match: { 'payment.status': 'PAID' } },
    {
      $group: {
        _id: null,
        gross: { $sum: '$fare.totalPayable' },
        commission: { $sum: '$fare.platformCommission' },
        driverPayout: { $sum: '$fare.driverPayout' },
      },
    },
  ]);
  const rev = revenueAgg[0] || { gross: 0, commission: 0, driverPayout: 0 };

  res.json({
    success: true,
    data: {
      totalCustomers,
      totalDrivers,
      totalVehicles,
      verifiedVehicles,
      activeLeases,
      pendingKycVehicles,
      openComplaints,
      totalDeliveries,
      completedDeliveries,
      searchingDeliveries,
      paidPayments,
      grossPayments: rev.gross,
      platformRevenue: rev.commission,
      driverEarnings: rev.driverPayout,
      platformCommissionDefault: config.platform.commissionPercent,
    },
  });
});

const listVehiclesForReview = asyncHandler(async (req, res) => {
  const status = req.query.status || 'PENDING';
  const vehicles = await Vehicle.find({ 'verification.status': status })
    .populate('owner', 'email mobile')
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ success: true, data: vehicles });
});

const reviewVehicle = asyncHandler(async (req, res) => {
  const { action, reason } = req.body;
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new AppError('Vehicle not found', 404);

  if (action === 'APPROVE') {
    vehicle.verification.status = 'APPROVED';
    vehicle.verification.reviewedBy = req.user._id;
    vehicle.verification.reviewedAt = new Date();
    vehicle.availability.status = 'AVAILABLE';
  } else if (action === 'REJECT') {
    vehicle.verification.status = 'REJECTED';
    vehicle.verification.rejectionReason = reason;
    vehicle.verification.reviewedBy = req.user._id;
    vehicle.verification.reviewedAt = new Date();
  } else if (action === 'SUSPEND') {
    vehicle.verification.status = 'SUSPENDED';
    vehicle.availability.status = 'UNAVAILABLE';
    vehicle.verification.reviewedBy = req.user._id;
    vehicle.verification.reviewedAt = new Date();
  } else {
    throw new AppError('Invalid action', 400);
  }
  await vehicle.save();
  res.json({ success: true, data: vehicle });
});

const updateCommission = asyncHandler(async (req, res) => {
  const { percent } = req.body;
  if (percent == null || percent < 0 || percent > 50) {
    throw new AppError('percent must be between 0 and 50', 400);
  }
  await Commission.updateMany({ isActive: true }, { isActive: false });
  const c = await Commission.create({ percent, isActive: true, updatedBy: req.user._id });
  res.json({ success: true, data: c });
});

const listDeliveries = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const list = await DeliveryBooking.find(filter)
    .populate('customer', 'name mobile email')
    .populate('driver', 'name mobile email')
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ success: true, data: list });
});

const listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  const users = await User.find(filter).select('-refreshTokens').sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, data: users });
});

const blockUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  user.isBlocked = !!req.body.blocked;
  user.blockReason = req.body.reason || '';
  await user.save();
  res.json({ success: true, data: user });
});

const getFareRule = asyncHandler(async (req, res) => {
  const rule = await FareRule.findOne({ isActive: true }).sort({ version: -1 });
  res.json({ success: true, data: rule });
});

const updateFareRule = asyncHandler(async (req, res) => {
  const current = await FareRule.findOne({ isActive: true }).sort({ version: -1 });
  const version = (current?.version || 0) + 1;
  if (current) {
    current.isActive = false;
    await current.save();
  }
  const rule = await FareRule.create({
    ...req.body,
    version,
    isActive: true,
    updatedBy: req.user._id,
  });
  res.json({ success: true, data: rule });
});

const listRewards = asyncHandler(async (req, res) => {
  const list = await Reward.find({ status: req.query.status || 'PENDING_APPROVAL' })
    .populate('user', 'name mobile email role')
    .sort({ updatedAt: -1 })
    .limit(50);
  res.json({ success: true, data: list });
});

const creditReward = asyncHandler(async (req, res) => {
  const r = await Reward.findById(req.params.id);
  if (!r) throw new AppError('Reward not found', 404);
  r.status = req.body.status === 'REJECTED' ? 'REJECTED' : 'CREDITED';
  if (r.status === 'CREDITED') r.creditedAt = new Date();
  await r.save();
  res.json({ success: true, data: r });
});

module.exports = {
  dashboard,
  listVehiclesForReview,
  reviewVehicle,
  updateCommission,
  listDeliveries,
  listUsers,
  blockUser,
  getFareRule,
  updateFareRule,
  listRewards,
  creditReward,
};
