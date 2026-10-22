const DriverLocation = require('../models/DriverLocation');
const DeliveryBooking = require('../models/DeliveryBooking');
const DriverProfile = require('../models/DriverProfile');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * Driver pushes GPS during an active booking.
 */
const updateLocation = asyncHandler(async (req, res) => {
  if (req.user.role !== 'DRIVER') {
    throw new AppError('Drivers only', 403);
  }

  const { coordinates, bookingId, heading, speed } = req.body;

  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    !Number.isFinite(Number(coordinates[0])) ||
    !Number.isFinite(Number(coordinates[1]))
  ) {
    throw new AppError('coordinates [lng,lat] required', 400);
  }

  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);

  if (
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new AppError('Invalid GPS coordinates', 400);
  }

  let booking = null;

  if (bookingId) {
    booking = await DeliveryBooking.findById(bookingId);

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (
      !booking.driver ||
      booking.driver.toString() !== req.user._id.toString()
    ) {
      throw new AppError('This booking is not assigned to you', 403);
    }
  }

  const locationData = {
    driver: req.user._id,
    booking: booking ? booking._id : undefined,
    coordinates: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    recordedAt: new Date(),
  };

  if (Number.isFinite(Number(heading))) {
    locationData.heading = Number(heading);
  }

  if (Number.isFinite(Number(speed))) {
    locationData.speed = Number(speed);
  }

  const loc = await DriverLocation.create(locationData);

  res.json({
    success: true,
    data: {
      id: loc._id,
      recordedAt: loc.recordedAt,
      coordinates: loc.coordinates.coordinates,
    },
  });
});

/**
 * Customer / driver / admin fetch booking tracking and driver details.
 */
const getBookingTracking = asyncHandler(async (req, res) => {
  const booking = await DeliveryBooking.findById(req.params.id)
    .populate('driver', 'name mobile email')
    .populate('customer', 'name mobile email');

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  const uid = req.user._id.toString();

  const allowed =
    booking.customer?._id?.toString() === uid ||
    booking.driver?._id?.toString() === uid ||
    req.user.role === 'ADMIN';

  if (!allowed) {
    throw new AppError('Forbidden', 403);
  }

  let driver = null;
  let driverLocation = null;

  if (booking.driver) {
    const driverUser = booking.driver;

    const driverProfile = await DriverProfile.findOne({
      user: driverUser._id,
    }).select('name mobile vehicleType vehicleCapacityKg');

    driver = {
      id: driverUser._id,
      name:
        driverUser.name ||
        driverProfile?.name ||
        '',
      mobile:
        driverUser.mobile ||
        driverProfile?.mobile ||
        '',
      phone:
        driverUser.mobile ||
        driverProfile?.mobile ||
        '',
      email: driverUser.email || '',
      vehicleType: driverProfile?.vehicleType || '',
      vehicleCapacityKg: driverProfile?.vehicleCapacityKg ?? null,
    };

    const latest = await DriverLocation.findOne({
      driver: driverUser._id,
      $or: [
        { booking: booking._id },
        { booking: { $exists: false } },
        { booking: null },
      ],
    })
      .sort({ recordedAt: -1 })
      .lean();

    if (latest) {
      driverLocation = {
        coordinates: latest.coordinates?.coordinates || null,
        heading: latest.heading ?? null,
        speed: latest.speed ?? null,
        recordedAt: latest.recordedAt || null,
      };
    }
  }

  res.json({
    success: true,
    data: {
      bookingId: booking.bookingId,
      status: booking.status,
      driver,
      driverLocation,
      pickup: booking.pickup,
      stops: booking.stops,
    },
  });
});

module.exports = {
  updateLocation,
  getBookingTracking,
};
