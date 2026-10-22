const FareRule = require('../models/FareRule');

/**
 * Haversine distance in km between [lng,lat] pairs
 */
function haversineKm(coordA, coordB) {
  if (!coordA || !coordB || coordA.length < 2 || coordB.length < 2) return 0;
  const toRad = (d) => (d * Math.PI) / 180;
  const [lng1, lat1] = coordA;
  const [lng2, lat2] = coordB;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Route distance: pickup → stop1 → stop2 → ...
 */
function computeRouteDistanceKm(pickupCoords, stops) {
  let total = 0;
  let prev = pickupCoords;
  for (const stop of stops || []) {
    const c = stop.address?.coordinates?.coordinates || stop.coordinates;
    if (c && prev) {
      total += haversineKm(prev, c);
      prev = c;
    }
  }
  // Road factor ~1.3 for city roads
  return Math.round(total * 1.3 * 100) / 100;
}

async function getActiveFareRule() {
  let rule = await FareRule.findOne({ isActive: true }).sort({ version: -1 });
  if (!rule) {
    rule = await FareRule.create({
      name: 'default',
      version: 1,
      isActive: true,
      baseFare: 40,
      perKmRate: 12,
      minFare: 50,
      platformCommissionPercent: 12,
    });
  }
  return rule;
}

/**
 * Fare = base + travel (distance).
 * Platform commission cut from total; rest is driver payout.
 * No weight / loading-help charges.
 */
async function calculateFare({
  pickupCoords,
  stops,
  vehicleType = 'E_RICKSHAW_GOODS',
}) {
  const rule = await getActiveFareRule();
  const distanceKm = computeRouteDistanceKm(pickupCoords, stops);
  const multiplier = rule.vehicleMultipliers?.[vehicleType] || 1;

  const baseFare = (rule.baseFare || 40) * multiplier;
  const travelCharge = distanceKm * (rule.perKmRate || 12) * multiplier;

  let totalPayable = Math.round(baseFare + travelCharge);
  const minFare = Math.round((rule.minFare || 50) * multiplier);
  if (totalPayable < minFare) totalPayable = minFare;

  const commissionPercent = rule.platformCommissionPercent ?? 12;
  const platformCommission = Math.round((totalPayable * commissionPercent) / 100);
  const driverPayout = totalPayable - platformCommission;

  const durationMinutes = Math.max(10, Math.round((distanceKm / 15) * 60 + 10));

  return {
    ruleVersion: rule.version,
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationMinutes,
    breakdown: {
      ruleVersion: rule.version,
      baseFare: Math.round(baseFare),
      travelCharge: Math.round(travelCharge),
      distanceCharge: Math.round(travelCharge),
      totalPayable,
      platformCommission,
      commissionPercent,
      driverPayout,
      currency: 'INR',
    },
  };
}

module.exports = {
  haversineKm,
  computeRouteDistanceKm,
  getActiveFareRule,
  calculateFare,
};
