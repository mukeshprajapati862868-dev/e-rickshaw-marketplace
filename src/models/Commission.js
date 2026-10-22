const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema(
  {
    percent: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
      default: 8,
    },
    isActive: { type: Boolean, default: true },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: Date,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
  },
  { timestamps: true }
);

commissionSchema.index({ isActive: 1, effectiveFrom: -1 });

module.exports = mongoose.model('Commission', commissionSchema);
