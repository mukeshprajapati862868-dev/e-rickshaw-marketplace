const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const Commission = require('../models/Commission');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { generateId, getRentForDuration, calculatePricing, daysBetween } = require('../utils/helpers');
const config = require('../config');

const getActiveCommission = async () => {
  const c = await Commission.findOne({ isActive: true }).sort({ effectiveFrom: -1 });
  return c ? c.percent : config.platform.commissionPercent;
};

const createBooking = asyncHandler(async (req, res) => {
  const { vehicleId, startDate, durationDays, notes } = req.body;
  if (!vehicleId || !startDate || !durationDays) {
    throw new AppError('vehicleId, startDate and durationDays are required', 400);
  }

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle || vehicle.verification.status !== 'APPROVED' || vehicle.availability.status !== 'AVAILABLE') {
    throw new AppError('Vehicle not available for booking', 400, 'VEHICLE_UNAVAILABLE');
  }

  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + Number(durationDays));

  const baseRent = getRentForDuration(vehicle, Number(durationDays));
  if (baseRent == null) {
    throw new AppError('Pricing not configured for this duration', 400);
  }

  const commissionPercent = await getActiveCommission();
  const pricing = calculatePricing({
    baseRent,
    securityDeposit: vehicle.securityDeposit || 0,
    commissionPercent,
  });

  const booking = await Booking.create({
    bookingId: generateId('BK'),
    driver: req.user._id,
    owner: vehicle.owner,
    vehicle: vehicle._id,
    durationDays: Number(durationDays),
    startDate: start,
    endDate: end,
    pricing,
    status: vehicle.availability.instantBooking ? 'PAYMENT_PENDING' : 'PENDING_OWNER',
    instantBooking: vehicle.availability.instantBooking,
    notes,
  });

  res.status(201).json({ success: true, data: booking });
});
const { createNotification } = require('./notificationController');
// ya
// const { createNotification } = require('../controllers/notificationController');

// Example – jab booking complete ho
const completeBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  booking.status = 'DELIVERED'; // ya COMPLETED
  await booking.save();

  // ---------- CUSTOMER ko notification ----------
  await createNotification({
    userId: booking.customer, // customer ObjectId
    title: 'Delivery Completed ✅',
    body: `Aapki booking ${booking.bookingId} successfully deliver ho gayi hai. Dhanyavaad!`,
    type: 'BOOKING_COMPLETED',
    data: {
      bookingId: booking._id,
      bookingCode: booking.bookingId,
      status: 'DELIVERED',
    },
  });

  // ---------- DRIVER ko notification (optional) ----------
  if (booking.driver) {
    await createNotification({
      userId: booking.driver,
      title: 'Trip Completed',
      body: `Booking ${booking.bookingId} complete ho gayi. Payout process ho raha hai.`,
      type: 'BOOKING_COMPLETED',
      data: {
        bookingId: booking._id,
        bookingCode: booking.bookingId,
        status: 'DELIVERED',
      },
    });
  }

  res.json({
    success: true,
    message: 'Booking completed',
    data: booking,
  });
});

const listMyBookings = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'DRIVER'
    ? { driver: req.user._id }
    : { owner: req.user._id };
  const bookings = await Booking.find(filter)
    .populate('vehicle', 'brand model photos type')
    .populate('driver', 'email')
    .populate('owner', 'email')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: bookings });
});

const respondToBooking = asyncHandler(async (req, res) => {
  const { action, reason } = req.body; // ACCEPT | REJECT
  const booking = await Booking.findOne({ _id: req.params.id, owner: req.user._id });
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.status !== 'PENDING_OWNER') {
    throw new AppError('Booking cannot be responded to in current status', 400);
  }

  if (action === 'ACCEPT') {
    booking.status = 'PAYMENT_PENDING';
    booking.ownerResponseAt = new Date();
  } else if (action === 'REJECT') {
    booking.status = 'REJECTED';
    booking.rejectionReason = reason || 'Rejected by owner';
    booking.ownerResponseAt = new Date();
  } else {
    throw new AppError('action must be ACCEPT or REJECT', 400);
  }
  await booking.save();
  res.json({ success: true, data: booking });
});

module.exports = {
  createBooking,
  listMyBookings,
  respondToBooking,
};
