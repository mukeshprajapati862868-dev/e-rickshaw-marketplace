const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    lease: { type: mongoose.Schema.Types.ObjectId, ref: 'Lease', required: true },
    targetType: {
      type: String,
      enum: ['OWNER', 'DRIVER', 'VEHICLE'],
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      maxlength: 1000,
    },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ratingSchema.index({ toUser: 1, targetType: 1 });
ratingSchema.index({ vehicle: 1 });
ratingSchema.index({ lease: 1, fromUser: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
