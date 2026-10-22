const mongoose = require('mongoose');

const driverLocationSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryBooking', index: true },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    heading: Number,
    speed: Number,
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

driverLocationSchema.index({ coordinates: '2dsphere' });
driverLocationSchema.index({ driver: 1, recordedAt: -1 });

module.exports = mongoose.model('DriverLocation', driverLocationSchema);
