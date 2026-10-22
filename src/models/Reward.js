const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['DRIVER', 'CUSTOMER'], required: true },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    completedCount: { type: Number, default: 0 },
    eligibleBookingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryBooking' }],
    tier: {
      type: String,
      enum: ['NONE', 'T20', 'T30', 'T50'],
      default: 'NONE',
    },
    amount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'PENDING_APPROVAL', 'CREDITED', 'REJECTED'],
      default: 'IN_PROGRESS',
    },
    creditedAt: Date,
    notes: String,
  },
  { timestamps: true }
);

rewardSchema.index({ user: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model('Reward', rewardSchema);
