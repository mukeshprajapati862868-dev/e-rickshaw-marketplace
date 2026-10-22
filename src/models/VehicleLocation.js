const mongoose = require('mongoose');

const vehicleLocationSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true,
    },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    accuracy: Number,
    speed: Number,
    heading: Number,
    source: {
      type: String,
      enum: ['DEVICE', 'MANUAL', 'LAST_KNOWN'],
      default: 'DEVICE',
    },
    recordedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

vehicleLocationSchema.index({ coordinates: '2dsphere' });
vehicleLocationSchema.index({ vehicle: 1, recordedAt: -1 });

// TTL optional: keep last 30 days of history
// vehicleLocationSchema.index({ recordedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('VehicleLocation', vehicleLocationSchema);
