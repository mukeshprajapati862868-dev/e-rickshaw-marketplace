const mongoose = require('mongoose');

const merchantPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    priceMonthly: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    maxDeliveriesPerMonth: { type: Number, default: 50 },
    discountPercent: { type: Number, default: 5 },
    benefits: [String],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MerchantPlan', merchantPlanSchema);
