
const mongoose = require('mongoose');

const driverProfileSchema = new mongoose.Schema(
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
        type: {
          type: String,
          enum: ['Point'],
        },
        coordinates: {
          type: [Number],
          default: undefined,
          validate: {
            validator: function (value) {
              if (value === undefined || value === null) {
                return true;
              }

              return (
                Array.isArray(value) &&
                value.length === 2 &&
                value.every(
                  (coordinate) =>
                    typeof coordinate === 'number' &&
                    Number.isFinite(coordinate)
                ) &&
                value[0] >= -180 &&
                value[0] <= 180 &&
                value[1] >= -90 &&
                value[1] <= 90
              );
            },
            message:
              'Coordinates must be [longitude, latitude] with valid values',
          },
        },
      },
    },
    profilePhoto: {
      url: String,
      publicId: String,
    },
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
    drivingLicence: {
      number: String,
      documentUrl: String,
      publicId: String,
      expiryDate: Date,
      status: {
        type: String,
        enum: ['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'EXPIRED'],
        default: 'PENDING',
      },
      verifiedAt: Date,
      rejectionReason: String,
    },
    selfie: {
      url: String,
      publicId: String,
      status: {
        type: String,
        enum: ['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED'],
        default: 'PENDING',
      },
      verifiedAt: Date,
    },
    overallVerificationStatus: {
      type: String,
      enum: ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'],
      default: 'UNVERIFIED',
    },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    totalLeases: { type: Number, default: 0 },
    preferredLocations: [String],
    isOnline: { type: Boolean, default: false },
    vehicleCapacityKg: { type: Number, default: 100 },
    vehicleType: {
      type: String,
      enum: ['E_RICKSHAW_GOODS', 'E_RICKSHAW_LARGE', 'AUTO_GOODS'],
      default: 'E_RICKSHAW_GOODS',
    },
  },
  { timestamps: true }
);

driverProfileSchema.index({ user: 1 });
driverProfileSchema.index({ 'address.coordinates': '2dsphere' });
driverProfileSchema.index({ overallVerificationStatus: 1 });
driverProfileSchema.index({ mobile: 1 });

module.exports = mongoose.model('DriverProfile', driverProfileSchema);
