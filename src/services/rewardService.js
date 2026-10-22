const Reward = require('../models/Reward');
const DeliveryBooking = require('../models/DeliveryBooking');

/** ISO week bounds (Mon 00:00 → Sun 23:59) in local time */
function getWeekBounds(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(d.getDate() + diffToMon);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { weekStart: start, weekEnd: end };
}

function driverTier(count) {
  if (count >= 50) return { tier: 'T50', amount: 500 };
  if (count >= 30) return { tier: 'T30', amount: 200 };
  if (count >= 20) return { tier: 'T20', amount: 100 };
  return { tier: 'NONE', amount: 0 };
}

function customerTier(count) {
  if (count >= 20) return { tier: 'T20', amount: 100 };
  return { tier: 'NONE', amount: 0 };
}

/**
 * Call when a delivery is completed — updates weekly progress for driver + customer
 */
async function onDeliveryCompleted(booking) {
  if (!booking || booking.status !== 'DELIVERED') return;

  const { weekStart, weekEnd } = getWeekBounds(booking.completedAt || new Date());

  // Driver
  if (booking.driver) {
    let dr = await Reward.findOne({ user: booking.driver, weekStart });
    if (!dr) {
      dr = await Reward.create({
        user: booking.driver,
        role: 'DRIVER',
        weekStart,
        weekEnd,
      });
    }
    if (!dr.eligibleBookingIds.some((id) => id.toString() === booking._id.toString())) {
      dr.eligibleBookingIds.push(booking._id);
      dr.completedCount = dr.eligibleBookingIds.length;
      const t = driverTier(dr.completedCount);
      dr.tier = t.tier;
      dr.amount = t.amount;
      if (t.amount > 0 && dr.status === 'IN_PROGRESS') {
        dr.status = 'PENDING_APPROVAL';
      }
      await dr.save();
    }
  }

  // Customer
  if (booking.customer) {
    let cr = await Reward.findOne({ user: booking.customer, weekStart });
    if (!cr) {
      cr = await Reward.create({
        user: booking.customer,
        role: 'CUSTOMER',
        weekStart,
        weekEnd,
      });
    }
    if (!cr.eligibleBookingIds.some((id) => id.toString() === booking._id.toString())) {
      cr.eligibleBookingIds.push(booking._id);
      cr.completedCount = cr.eligibleBookingIds.length;
      const t = customerTier(cr.completedCount);
      cr.tier = t.tier;
      cr.amount = t.amount;
      if (t.amount > 0 && cr.status === 'IN_PROGRESS') {
        cr.status = 'PENDING_APPROVAL';
      }
      await cr.save();
    }
  }
}

async function getMyWeekProgress(userId, role) {
  const { weekStart, weekEnd } = getWeekBounds();
  let r = await Reward.findOne({ user: userId, weekStart });
  if (!r) {
    r = {
      completedCount: 0,
      tier: 'NONE',
      amount: 0,
      status: 'IN_PROGRESS',
      weekStart,
      weekEnd,
    };
  }
  const nextTarget =
    role === 'DRIVER'
      ? r.completedCount >= 50
        ? null
        : r.completedCount >= 30
          ? 50
          : r.completedCount >= 20
            ? 30
            : 20
      : r.completedCount >= 20
        ? null
        : 20;
  return { ...r.toObject?.() || r, nextTarget };
}

module.exports = {
  getWeekBounds,
  onDeliveryCompleted,
  getMyWeekProgress,
  driverTier,
  customerTier,
};
