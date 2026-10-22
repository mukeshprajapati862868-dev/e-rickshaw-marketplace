const mongoose = require('mongoose');

const RENT_DURATIONS = [1, 7, 15, 30, 60, 90]; // days

const vehicleSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['E_RICKSHAW', 'AUTO', 'E_AUTO', 'OTHER'],
      default: 'E_RICKSHAW',
    },
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    manufacturingYear: {
      type: Number,
      min: 2010,
      max: new Date().getFullYear() + 1,
    },
    photos: [
      {
        url: String,
        publicId: String,
        isPrimary: { type: Boolean, default: false },
      },
    ],
    battery: {
      included: { type: Boolean, default: true },
      type: String,
      capacity: String,
      condition: { type: String, enum: ['NEW', 'GOOD', 'AVERAGE', 'POOR'] },
    },
    location: {
      address: String,
      city: String,
      state: String,
      pincode: String,
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: undefined }, // [lng, lat]
      },
    },
    rent: {
      daily: { type: Number, min: 0 },
      weekly: { type: Number, min: 0 }, // 7 days
      fifteenDay: { type: Number, min: 0 },
      monthly: { type: Number, min: 0 }, // 30 days
      threeMonth: { type: Number, min: 0 }, // 90 days
    },
    securityDeposit: {
      type: Number,
      required: true,
      min: 0,
    },
    availability: {
      status: {
        type: String,
        enum: ['AVAILABLE', 'UNAVAILABLE', 'MAINTENANCE', 'LEASED'],
        default: 'UNAVAILABLE',
      },
      instantBooking: { type: Boolean, default: false },
    },
    verification: {
      status: {
        type: String,
        enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'],
        default: 'PENDING',
      },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: Date,
      rejectionReason: String,
      inspectionNotes: String,
    },
    documents: {
      rc: {
        url: String,
        publicId: String,
        status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
      },
      insurance: {
        url: String,
        publicId: String,
        expiryDate: Date,
        status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'], default: 'PENDING' },
      },
      fitness: {
        url: String,
        publicId: String,
        expiryDate: Date,
        status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'], default: 'PENDING' },
      },
      permit: {
        url: String,
        publicId: String,
        expiryDate: Date,
        status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'], default: 'PENDING' },
      },
    },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    totalLeases: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    features: [String],
    description: { type: String, maxlength: 1000 },
  },
  { timestamps: true }
);

vehicleSchema.index({ owner: 1 });
vehicleSchema.index({ registrationNumber: 1 });
vehicleSchema.index({ 'location.coordinates': '2dsphere' });
vehicleSchema.index({ 'availability.status': 1, 'verification.status': 1 });
vehicleSchema.index({ type: 1, 'location.city': 1 });
vehicleSchema.index({ 'rent.daily': 1 });

// Virtual for public display (mask full registration)
vehicleSchema.virtual('displayRegistration').get(function () {
  if (!this.registrationNumber) return '';
  const reg = this.registrationNumber;
  if (reg.length <= 4) return reg;
  return `${reg.slice(0, 2)}**${reg.slice(-2)}`;
});

vehicleSchema.set('toJSON', { virtuals: true });
vehicleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);
module.exports.RENT_DURATIONS = RENT_DURATIONS;
