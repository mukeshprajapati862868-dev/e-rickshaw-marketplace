const mongoose = require('mongoose');

const ownerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    mobile: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Invalid Indian mobile number'],
    },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: undefined },
      },
    },
    profilePhoto: {
      url: String,
      publicId: String,
    },
    kyc: {
      aadhaar: {
        number: String,
        documentUrl: String,
        publicId: String,
        status: {
          type: String,
          enum: ['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED'],
          default: 'PENDING',
        },
        verifiedAt: Date,
        rejectionReason: String,
      },
      pan: {
        number: String,
        documentUrl: String,
        publicId: String,
        status: {
          type: String,
          enum: ['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED'],
          default: 'PENDING',
        },
        verifiedAt: Date,
        rejectionReason: String,
      },
      overallStatus: {
        type: String,
        enum: ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'],
        default: 'UNVERIFIED',
      },
    },
    bankDetails: {
      accountHolderName: String,
      accountNumber: String, // encrypt in production or use tokenization
      ifsc: String,
      bankName: String,
      upiId: String,
      verified: { type: Boolean, default: false },
    },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    totalVehicles: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    pendingSettlement: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ownerProfileSchema.index({ user: 1 });
ownerProfileSchema.index({ 'kyc.overallStatus': 1 });
ownerProfileSchema.index({ mobile: 1 });

module.exports = mongoose.model('OwnerProfile', ownerProfileSchema);
