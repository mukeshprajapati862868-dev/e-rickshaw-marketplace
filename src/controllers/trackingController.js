const DriverLocation = require('../models/DriverLocation');
const DeliveryBooking = require('../models/DeliveryBooking');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/** Driver pushes GPS during active booking */
const updateLocation = asyncHandler(async (req, res) => {
  if (req.user.role !== 'DRIVER') throw new AppError('Drivers only', 403);
  const { coordinates, bookingId, heading, speed } = req.body;
  if (!coordinates || coordinates.length < 2) {
    throw new AppError('coordinates [lng,lat] required', 400);
  }

  const loc = await DriverLocation.create({
    driver: req.user._id,
    booking: bookingId || undefined,
    coordinates: { type: 'Point', coordinates },
    heading,
    speed,
    recordedAt: new Date(),
  });

  res.json({ success: true, data: { id: loc._id, recordedAt: loc.recordedAt } });
});

/** Customer / admin get latest driver position for a booking */
const getBookingTracking = asyncHandler(async (req, res) => {
  const booking = await DeliveryBooking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);

  const uid = req.user._id.toString();
  const allowed =
    booking.customer?.toString() === uid ||
    booking.driver?.toString() === uid ||
    req.user.role === 'ADMIN';
  if (!allowed) throw new AppError('Forbidden', 403);

  let latest = null;
  if (booking.driver) {
    latest = await DriverLocation.findOne({
      $or: [{ booking: booking._id }, { driver: booking.driver }],
    })
      .sort({ recordedAt: -1 })
      .limit(1);
  }

  res.json({
    success: true,
    data: {
      bookingId: booking.bookingId,
      status: booking.status,
      driverLocation: latest
        ? {
            coordinates: latest.coordinates.coordinates,
            heading: latest.heading,
            speed: latest.speed,
            recordedAt: latest.recordedAt,
          }
        : null,
      pickup: booking.pickup,
      stops: booking.stops,
    },
  });
});

module.exports = { updateLocation, getBookingTracking };
