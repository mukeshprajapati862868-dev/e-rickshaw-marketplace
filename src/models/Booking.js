const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true,
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    pricing: {
      baseRent: { type: Number, required: true },
      securityDeposit: { type: Number, required: true },
      platformFee: { type: Number, required: true },
      taxes: { type: Number, default: 0 },
      gatewayCharges: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
      commissionPercent: { type: Number, required: true },
      ownerSettlement: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: [
        'PENDING_OWNER',
        'ACCEPTED',
        'REJECTED',
        'PAYMENT_PENDING',
        'PAID',
        'ACTIVE',
        'COMPLETED',
        'CANCELLED',
        'DISPUTED',
        'EXPIRED',
      ],
      default: 'PENDING_OWNER',
      index: true,
    },
    instantBooking: { type: Boolean, default: false },
    ownerResponseAt: Date,
    rejectionReason: String,
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    lease: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lease',
    },
    agreement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agreement',
    },
    notes: String,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: String,
    cancelledAt: Date,
  },
  { timestamps: true }
);

bookingSchema.index({ driver: 1, status: 1 });
bookingSchema.index({ owner: 1, status: 1 });
bookingSchema.index({ vehicle: 1, status: 1 });
bookingSchema.index({ startDate: 1, endDate: 1 });
bookingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
