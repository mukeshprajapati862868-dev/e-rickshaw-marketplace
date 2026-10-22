const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantPlan', required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING_PAYMENT'],
      default: 'PENDING_PAYMENT',
    },
    startsAt: Date,
    endsAt: Date,
    deliveriesUsed: { type: Number, default: 0 },
    razorpayPaymentId: String,
    amountPaid: Number,
  },
  { timestamps: true }
);

subscriptionSchema.index({ user: 1, status: 1 });
module.exports = mongoose.model('Subscription', subscriptionSchema);
