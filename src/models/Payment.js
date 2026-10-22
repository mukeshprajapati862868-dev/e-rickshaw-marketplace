const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, unique: true, required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    lease: { type: mongoose.Schema.Types.ObjectId, ref: 'Lease', index: true },
    payer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    payee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // owner
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    type: {
      type: String,
      enum: ['BOOKING', 'EXTENSION', 'DEPOSIT', 'REFUND', 'SETTLEMENT', 'PENALTY'],
      required: true,
    },
    breakdown: {
      baseRent: Number,
      securityDeposit: Number,
      platformFee: Number,
      taxes: Number,
      gatewayCharges: Number,
      total: Number,
    },
    gateway: {
      provider: { type: String, enum: ['RAZORPAY', 'MANUAL', 'OTHER'], default: 'RAZORPAY' },
      orderId: String,
      paymentId: String,
      signature: String,
      method: String, // UPI, card, netbanking, etc.
      status: {
        type: String,
        enum: ['CREATED', 'ATTEMPTED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL_REFUND'],
        default: 'CREATED',
      },
      rawResponse: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    receiptUrl: String,
    refundAmount: { type: Number, default: 0 },
    refundReason: String,
    refundedAt: Date,
    notes: String,
  },
  { timestamps: true }
);

paymentSchema.index({ 'gateway.orderId': 1 });
paymentSchema.index({ 'gateway.paymentId': 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
