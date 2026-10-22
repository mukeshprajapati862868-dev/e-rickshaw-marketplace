const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema(
  {
    settlementId: { type: String, unique: true, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lease: { type: mongoose.Schema.Types.ObjectId, ref: 'Lease' },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    grossAmount: { type: Number, required: true },
    commissionPercent: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ON_HOLD'],
      default: 'PENDING',
      index: true,
    },
    payout: {
      method: { type: String, enum: ['BANK_TRANSFER', 'UPI', 'MANUAL'] },
      reference: String,
      processedAt: Date,
      failureReason: String,
    },
    period: {
      from: Date,
      to: Date,
    },
    notes: String,
  },
  { timestamps: true }
);

settlementSchema.index({ owner: 1, status: 1 });
settlementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Settlement', settlementSchema);
