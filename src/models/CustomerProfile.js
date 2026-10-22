const mongoose = require('mongoose');

const customerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    name: { type: String, trim: true, maxlength: 100 },
    shopName: { type: String, trim: true, maxlength: 150 },
    mobile: String,
    address: {
      line1: String,
      line2: String,
      city: { type: String, default: 'Lucknow' },
      state: { type: String, default: 'Uttar Pradesh' },
      pincode: String,
      coordinates: {
  type: mongoose.Schema.Types.Mixed,
  default: undefined,
},
    },
    profilePhoto: { url: String, publicId: String },
    totalBookings: { type: Number, default: 0 },
    completedBookings: { type: Number, default: 0 },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    preferredLanguage: { type: String, enum: ['en', 'hi'], default: 'hi' },
  },
  { timestamps: true }
);


customerProfileSchema.index({ 'address.coordinates': '2dsphere' });

module.exports = mongoose.model('CustomerProfile', customerProfileSchema);
