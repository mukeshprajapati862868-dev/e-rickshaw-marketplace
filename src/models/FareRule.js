const mongoose = require('mongoose');

/**
 * Configurable pricing for goods delivery (Lucknow e-riksha)
 * Admin can update; fare service uses active rule version.
 */
const fareRuleSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'default' },
    version: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    currency: { type: String, default: 'INR' },
    // Base
    baseFare: { type: Number, default: 40 },
    perKmRate: { type: Number, default: 12 },
    minFare: { type: Number, default: 50 },
    // Pickup leg (driver to customer) — partial cost
    pickupPerKmRate: { type: Number, default: 4 },
    maxPickupCharge: { type: Number, default: 30 },
    // Cargo
    weightTiers: [
      {
        maxKg: Number,
        surcharge: Number,
      },
    ],
    loadingAssistanceFee: { type: Number, default: 30 },
    unloadingAssistanceFee: { type: Number, default: 30 },
    // Waiting
    freeWaitingMinutes: { type: Number, default: 10 },
    waitingPerMinute: { type: Number, default: 2 },
    // Platform
    platformCommissionPercent: { type: Number, default: 12 },
    gstPercent: { type: Number, default: 0 },
    // Vehicle multipliers
    vehicleMultipliers: {
      E_RICKSHAW_GOODS: { type: Number, default: 1 },
      E_RICKSHAW_LARGE: { type: Number, default: 1.25 },
      AUTO_GOODS: { type: Number, default: 1.15 },
    },
    // Multi-stop
    perExtraStopFee: { type: Number, default: 25 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

fareRuleSchema.index({ isActive: 1, version: -1 });

module.exports = mongoose.model('FareRule', fareRuleSchema);
