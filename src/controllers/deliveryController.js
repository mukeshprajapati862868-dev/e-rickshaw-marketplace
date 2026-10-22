
const DeliveryBooking = require('../models/DeliveryBooking');
const DriverProfile = require('../models/DriverProfile');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { generateId } = require('../utils/helpers');
const { calculateFare } = require('../services/fareService');
const { onDeliveryCompleted } = require('../services/rewardService');
const { findReturnLoads } = require('../services/returnLoadService');
const { createNotification } = require('./notificationController');
const crypto = require('crypto');

/**
 * POST /api/delivery/estimate
 */
const estimateFare = asyncHandler(async (req, res) => {
  const { pickup, stops, goods, vehicleType, driverCoords } = req.body;
  if (!pickup?.coordinates?.coordinates) {
    throw new AppError('Pickup coordinates required', 400);
  }
  if (!stops || !stops.length) {
    throw new AppError('At least one delivery stop required', 400);
  }

  const result = await calculateFare({
    pickupCoords: pickup.coordinates.coordinates,
    stops,
    vehicleType: vehicleType || 'E_RICKSHAW_GOODS',
  });

  res.json({ success: true, data: result });
});

/**
 * POST /api/delivery/bookings
 */
const createBooking = asyncHandler(async (req, res) => {
  const { pickup, stops, goods, vehicleType, paymentMethod, customerNotes, scheduledAt } = req.body;

  if (!pickup?.coordinates?.coordinates) {
    throw new AppError('Pickup location required', 400);
  }
  if (!stops?.length) {
    throw new AppError('At least one stop required', 400);
  }

  const fareResult = await calculateFare({
    pickupCoords: pickup.coordinates.coordinates,
    stops,
    vehicleType: vehicleType || 'E_RICKSHAW_GOODS',
  });

  const booking = await DeliveryBooking.create({
    bookingId: generateId('DL'),
    customer: req.user._id,
    vehicleType: vehicleType || 'E_RICKSHAW_GOODS',
    pickup,
    stops: stops.map((s, i) => ({
      sequence: i + 1,
      address: s.address || s,
      status: 'PENDING',
    })),
    goods: goods || {},
    route: {
      distanceKm: fareResult.distanceKm,
      durationMinutes: fareResult.durationMinutes,
      pickupDistanceKm: fareResult.pickupDistanceKm,
    },
    fare: fareResult.breakdown,
    payment: {
      method: paymentMethod === 'CASH' ? 'CASH' : 'RAZORPAY',
      status: paymentMethod === 'CASH' ? 'CASH_PENDING' : 'PENDING',
    },
    status: 'SEARCHING',
    customerNotes,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
  });

  res.status(201).json({ success: true, data: booking });
});

/**
 * GET /api/delivery/bookings/my
 */
const myBookings = asyncHandler(async (req, res) => {
  const filter =
    req.user.role === 'DRIVER'
      ? { driver: req.user._id }
      : { customer: req.user._id };

  const list = await DeliveryBooking.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('customer', 'name mobile email')
    .populate('driver', 'name mobile email');

  res.json({ success: true, data: list });
});

/**
 * GET /api/delivery/bookings/:id
 */
const getBooking = asyncHandler(async (req, res) => {
  const booking = await DeliveryBooking.findById(req.params.id)
    .populate('customer', 'name mobile email')
    .populate('driver', 'name mobile email');

  if (!booking) throw new AppError('Booking not found', 404);

  const uid = req.user._id.toString();
  const isParty =
    booking.customer?._id?.toString() === uid ||
    booking.driver?._id?.toString() === uid ||
    req.user.role === 'ADMIN';
  if (!isParty) throw new AppError('Forbidden', 403);

  res.json({ success: true, data: booking });
});

/**
 * GET /api/delivery/requests
 */
const nearbyRequests = asyncHandler(async (req, res) => {
  if (req.user.role !== 'DRIVER') throw new AppError('Drivers only', 403);

  const list = await DeliveryBooking.find({ status: 'SEARCHING' })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('customer', 'name mobile');

  res.json({ success: true, data: list });
});

/**
 * POST /api/delivery/bookings/:id/accept
 */
const acceptBooking = asyncHandler(async (req, res) => {
  if (req.user.role !== 'DRIVER') throw new AppError('Drivers only', 403);

  const booking = await DeliveryBooking.findOne({
    _id: req.params.id,
    status: 'SEARCHING',
  });
  if (!booking) throw new AppError('Booking not available', 404);

  booking.driver = req.user._id;
  booking.status = 'DRIVER_ASSIGNED';
  booking.acceptedAt = new Date();
  await booking.save();

  // ===== Customer ko notification =====
  if (booking.customer) {
    await createNotification({
      userId: booking.customer,
      title: 'Driver Assigned ✅',
      body: `Aapki booking ${booking.bookingId} ke liye driver assign ho gaya hai.`,
      type: 'BOOKING_ACCEPTED',
      data: {
        bookingId: booking._id,
        bookingCode: booking.bookingId,
        status: 'DRIVER_ASSIGNED',
      },
    });
  }

  res.json({ success: true, data: booking });
});

/**
 * PATCH /api/delivery/bookings/:id/status
 */
const updateStatus = asyncHandler(async (req, res) => {
  const { status, stopId } = req.body;
  const allowed = ['DRIVER_ARRIVING', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
  if (!allowed.includes(status)) throw new AppError('Invalid status', 400);

  const booking = await DeliveryBooking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);

  const uid = req.user._id.toString();
  const isDriver = booking.driver?.toString() === uid;
  const isCustomer = booking.customer?.toString() === uid;
  const isAdmin = req.user.role === 'ADMIN';

  if (status === 'CANCELLED') {
    if (!isCustomer && !isDriver && !isAdmin) throw new AppError('Forbidden', 403);
    booking.status = 'CANCELLED';
    booking.cancelledAt = new Date();
    booking.cancelledBy = req.user._id;
    booking.cancellationReason = req.body.reason || '';

    // Dusri party ko cancel notification
    const notifyUserId = isCustomer ? booking.driver : booking.customer;
    if (notifyUserId) {
      await createNotification({
        userId: notifyUserId,
        title: 'Booking Cancelled',
        body: `Booking ${booking.bookingId} cancel ho gayi hai.`,
        type: 'BOOKING_REJECTED',
        data: {
          bookingId: booking._id,
          bookingCode: booking.bookingId,
          status: 'CANCELLED',
        },
      });
    }
  } else {
    if (!isDriver && !isAdmin) throw new AppError('Only assigned driver can update', 403);
    booking.status = status;
    if (status === 'PICKED_UP') booking.pickedUpAt = new Date();

    if (status === 'DELIVERED') {
      booking.completedAt = new Date();
      if (stopId) {
        const stop = booking.stops.id(stopId);
        if (stop) {
          stop.status = 'DELIVERED';
          stop.deliveredAt = new Date();
        }
      } else {
        booking.stops.forEach((s) => {
          s.status = 'DELIVERED';
          s.deliveredAt = new Date();
        });
      }

      // ===== COMPLETE notification =====
      if (booking.customer) {
        await createNotification({
          userId: booking.customer,
          title: 'Delivery Completed ✅',
          body: `Aapki booking ${booking.bookingId} successfully deliver ho gayi hai. Dhanyavaad!`,
          type: 'BOOKING_COMPLETED',
          data: {
            bookingId: booking._id,
            bookingCode: booking.bookingId,
            status: 'DELIVERED',
          },
        });
      }

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
    }
  }

  await booking.save();

  if (status === 'DELIVERED') {
    try {
      await onDeliveryCompleted(booking);
    } catch (_) {}
  }

  res.json({ success: true, data: booking });
});

/**
 * POST /api/delivery/bookings/:id/generate-proof-otp
 */
const generateProofOtp = asyncHandler(async (req, res) => {
  const booking = await DeliveryBooking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.driver?.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
    throw new AppError('Forbidden', 403);
  }
  const stopId = req.body.stopId;
  const otp = String(crypto.randomInt(100000, 999999));
  if (stopId) {
    const stop = booking.stops.id(stopId);
    if (!stop) throw new AppError('Stop not found', 404);
    stop.recipientOtp = otp;
    stop.recipientOtpVerified = false;
  } else if (booking.stops.length) {
    booking.stops[booking.stops.length - 1].recipientOtp = otp;
    booking.stops[booking.stops.length - 1].recipientOtpVerified = false;
  }
  await booking.save();
  console.log(`\n[PROOF OTP] booking=${booking.bookingId} OTP=${otp}\n`);
  res.json({
    success: true,
    data: {
      message: 'OTP generated for recipient',
      otpDev: process.env.NODE_ENV !== 'production' ? otp : undefined,
    },
  });
});

/**
 * POST /api/delivery/bookings/:id/verify-proof-otp
 */
const verifyProofOtp = asyncHandler(async (req, res) => {
  const { otp, stopId } = req.body;
  const booking = await DeliveryBooking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.driver?.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
    throw new AppError('Forbidden', 403);
  }
  let stop = stopId ? booking.stops.id(stopId) : booking.stops[booking.stops.length - 1];
  if (!stop) throw new AppError('Stop not found', 404);
  if (!stop.recipientOtp || stop.recipientOtp !== String(otp)) {
    throw new AppError('Invalid delivery OTP', 400);
  }
  stop.recipientOtpVerified = true;
  stop.status = 'DELIVERED';
  stop.deliveredAt = new Date();
  await booking.save();
  res.json({ success: true, data: booking });
});

/**
 * PATCH /api/delivery/driver/online
 */
const setOnlineStatus = asyncHandler(async (req, res) => {
  if (req.user.role !== 'DRIVER') throw new AppError('Drivers only', 403);
  const { online } = req.body;
  let profile = await DriverProfile.findOne({ user: req.user._id });
  if (!profile) {
    profile = await DriverProfile.create({ user: req.user._id });
  }
  profile.isOnline = !!online;
  if (req.body.coordinates) {
    profile.address = profile.address || {};
    profile.address.coordinates = {
      type: 'Point',
      coordinates: req.body.coordinates,
    };
  }
  await profile.save();
  res.json({ success: true, data: { online: profile.isOnline } });
});

/**
 * GET /api/delivery/return-loads
 */
const returnLoads = asyncHandler(async (req, res) => {
  if (req.user.role !== 'DRIVER') throw new AppError('Drivers only', 403);
  const lng = parseFloat(req.query.lng);
  const lat = parseFloat(req.query.lat);
  const nearCoords = !isNaN(lng) && !isNaN(lat) ? [lng, lat] : null;
  const maxExtraKm = parseFloat(req.query.maxExtraKm) || 5;
  const data = await findReturnLoads({
    driverId: req.user._id,
    nearCoords,
    maxExtraKm,
  });
  res.json({ success: true, data });
});

/**
 * POST /api/delivery/bookings/:id/backup-driver
 */
const assignBackupDriver = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'DRIVER') {
    throw new AppError('Forbidden', 403);
  }
  const booking = await DeliveryBooking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  const { driverId, reason } = req.body;
  if (!driverId) throw new AppError('driverId required', 400);

  if (booking.driver) {
    booking.backupDriver = booking.driver;
  }
  booking.driver = driverId;
  booking.status = 'DRIVER_ASSIGNED';
  booking.driverNotes = (booking.driverNotes || '') + ` | Backup: ${reason || ''}`;
  await booking.save();
  res.json({ success: true, data: booking });
});

/**
 * POST /api/delivery/bookings/:id/repeat
 */
const repeatBooking = asyncHandler(async (req, res) => {
  const prev = await DeliveryBooking.findById(req.params.id);
  if (!prev) throw new AppError('Booking not found', 404);
  if (prev.customer.toString() !== req.user._id.toString()) {
    throw new AppError('Forbidden', 403);
  }

  const fareResult = await calculateFare({
    pickupCoords: prev.pickup.coordinates.coordinates,
    stops: prev.stops,
    vehicleType: prev.vehicleType,
  });

  const booking = await DeliveryBooking.create({
    bookingId: generateId('DL'),
    customer: req.user._id,
    vehicleType: prev.vehicleType,
    pickup: prev.pickup,
    stops: prev.stops.map((s, i) => ({
      sequence: i + 1,
      address: s.address,
      status: 'PENDING',
    })),
    goods: prev.goods,
    route: {
      distanceKm: fareResult.distanceKm,
      durationMinutes: fareResult.durationMinutes,
    },
    fare: fareResult.breakdown,
    payment: { method: 'RAZORPAY', status: 'PENDING' },
    status: 'SEARCHING',
    customerNotes: 'Repeat of ' + prev.bookingId,
  });

  res.status(201).json({ success: true, data: booking });
});

/**
 * POST /api/delivery/bookings/schedule
 */
const scheduleBooking = asyncHandler(async (req, res) => {
  const { pickup, stops, goods, vehicleType, scheduledAt, paymentMethod } = req.body;
  if (!scheduledAt) throw new AppError('scheduledAt required', 400);
  if (!pickup?.coordinates?.coordinates || !stops?.length) {
    throw new AppError('pickup and stops required', 400);
  }

  const fareResult = await calculateFare({
    pickupCoords: pickup.coordinates.coordinates,
    stops,
    vehicleType: vehicleType || 'E_RICKSHAW_GOODS',
  });

  const booking = await DeliveryBooking.create({
    bookingId: generateId('DL'),
    customer: req.user._id,
    vehicleType: vehicleType || 'E_RICKSHAW_GOODS',
    pickup,
    stops: stops.map((s, i) => ({
      sequence: i + 1,
      address: s.address || s,
      status: 'PENDING',
    })),
    goods: goods || {},
    route: {
      distanceKm: fareResult.distanceKm,
      durationMinutes: fareResult.durationMinutes,
    },
    fare: fareResult.breakdown,
    payment: {
      method: paymentMethod === 'CASH' ? 'CASH' : 'RAZORPAY',
      status: paymentMethod === 'CASH' ? 'CASH_PENDING' : 'PENDING',
    },
    status: 'DRAFT',
    scheduledAt: new Date(scheduledAt),
  });

  res.status(201).json({ success: true, data: booking });
});

module.exports = {
  estimateFare,
  createBooking,
  myBookings,
  getBooking,
  nearbyRequests,
  acceptBooking,
  updateStatus,
  setOnlineStatus,
  generateProofOtp,
  verifyProofOtp,
  returnLoads,
  assignBackupDriver,
  repeatBooking,
  scheduleBooking,
};