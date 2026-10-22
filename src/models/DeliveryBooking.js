const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema(
  {
    sequence: { type: Number, required: true },
    address: {
      line1: String,
      line2: String,
      landmark: String,
      city: String,
      pincode: String,
      contactName: String,
      contactPhone: String,
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: [Number],
      },
    },
    status: {
      type: String,
      enum: ['PENDING', 'ARRIVED', 'DELIVERED', 'FAILED', 'SKIPPED'],
      default: 'PENDING',
    },
    deliveredAt: Date,
    proofPhotoUrl: String,
    recipientOtp: String,
    recipientOtpVerified: { type: Boolean, default: false },
    notes: String,
  },
  { _id: true }
);

const deliveryBookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, unique: true, required: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    vehicleType: {
      type: String,
      enum: ['E_RICKSHAW_GOODS', 'E_RICKSHAW_LARGE', 'AUTO_GOODS'],
      default: 'E_RICKSHAW_GOODS',
    },
    pickup: {
      line1: String,
      line2: String,
      landmark: String,
      city: { type: String, default: 'Lucknow' },
      pincode: String,
      contactName: String,
      contactPhone: String,
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: [Number],
      },
    },
    stops: [stopSchema],
    goods: {
      category: {
        type: String,
        enum: [
          'GROCERY',
          'VEGETABLES',
          'HARDWARE',
          'APPAREL',
          'ELECTRONICS',
          'CONSTRUCTION',
          'DOCUMENTS',
          'OTHER',
        ],
        default: 'OTHER',
      },
      description: String,
      quantity: { type: Number, default: 1 },
      estimatedWeightKg: { type: Number, default: 10 },
      dimensions: {
        lengthCm: Number,
        widthCm: Number,
        heightCm: Number,
      },
      needsLoadingHelp: { type: Boolean, default: false },
      needsUnloadingHelp: { type: Boolean, default: false },
    },
    route: {
      distanceKm: Number,
      durationMinutes: Number,
      pickupDistanceKm: Number,
      polyline: String,
    },
    fare: {
      ruleVersion: Number,
      baseFare: Number,
      distanceCharge: Number,
      pickupCharge: Number,
      weightSurcharge: Number,
      loadingFee: Number,
      unloadingFee: Number,
      extraStopsFee: Number,
      waitingCharge: Number,
      subtotal: Number,
      gst: Number,
      discount: Number,
      totalPayable: Number,
      platformCommission: Number,
      driverPayout: Number,
      currency: { type: String, default: 'INR' },
    },
    payment: {
      method: {
        type: String,
        enum: ['RAZORPAY', 'CASH', 'WALLET'],
        default: 'RAZORPAY',
      },
      status: {
        type: String,
        enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CASH_PENDING'],
        default: 'PENDING',
      },
      razorpayOrderId: String,
      razorpayPaymentId: String,
      paidAt: Date,
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'SEARCHING',
        'DRIVER_ASSIGNED',
        'DRIVER_ARRIVING',
        'PICKED_UP',
        'IN_TRANSIT',
        'DELIVERED',
        'CANCELLED',
        'DISPUTED',
      ],
      default: 'DRAFT',
      index: true,
    },
    scheduledAt: Date,
    acceptedAt: Date,
    pickedUpAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: String,
    backupDriver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerNotes: String,
    driverNotes: String,
    rating: {
      byCustomer: { score: Number, review: String },
      byDriver: { score: Number, review: String },
    },
  },
  { timestamps: true }
);

deliveryBookingSchema.index({ customer: 1, status: 1, createdAt: -1 });
deliveryBookingSchema.index({ driver: 1, status: 1, createdAt: -1 });
deliveryBookingSchema.index({ 'pickup.coordinates': '2dsphere' });
deliveryBookingSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('DeliveryBooking', deliveryBookingSchema);
