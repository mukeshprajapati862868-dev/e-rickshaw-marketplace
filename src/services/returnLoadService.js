const DeliveryBooking = require('../models/DeliveryBooking');
const { haversineKm } = require('./fareService');

/**
 * Find SEARCHING jobs near a driver's likely return path (near last drop or given point).
 */
async function findReturnLoads({ driverId, nearCoords, maxExtraKm = 5, maxResults = 10 }) {
  if (!nearCoords || nearCoords.length < 2) {
    return DeliveryBooking.find({ status: 'SEARCHING' })
      .sort({ createdAt: -1 })
      .limit(maxResults)
      .populate('customer', 'name mobile');
  }

  const open = await DeliveryBooking.find({ status: 'SEARCHING' })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('customer', 'name mobile');

  const scored = open
    .map((b) => {
      const pickup = b.pickup?.coordinates?.coordinates;
      if (!pickup) return null;
      const extraKm = haversineKm(nearCoords, pickup) * 1.3;
      if (extraKm > maxExtraKm) return null;
      return {
        booking: b,
        extraKm: Math.round(extraKm * 100) / 100,
        estimatedPayout: b.fare?.driverPayout ?? b.fare?.totalPayable,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.extraKm - b.extraKm)
    .slice(0, maxResults);

  return scored;
}

module.exports = { findReturnLoads };
