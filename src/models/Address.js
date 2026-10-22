const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    label: {
      type: String,
      enum: ['HOME', 'SHOP', 'WAREHOUSE', 'OTHER'],
      default: 'OTHER',
    },
    name: String,
    phone: String,
    line1: { type: String, required: true },
    line2: String,
    landmark: String,
    city: { type: String, default: 'Lucknow' },
    state: { type: String, default: 'Uttar Pradesh' },
    pincode: String,
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

addressSchema.index({ coordinates: '2dsphere' });
addressSchema.index({ user: 1, isDefault: 1 });

module.exports = mongoose.model('Address', addressSchema);
