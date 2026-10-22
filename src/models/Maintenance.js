const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema(
  {
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['REPAIR', 'SERVICE', 'INSPECTION', 'BATTERY', 'OTHER'],
      required: true,
    },
    description: { type: String, required: true },
    cost: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'SCHEDULED',
    },
    scheduledAt: Date,
    completedAt: Date,
    vendor: String,
    invoiceUrl: String,
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Maintenance', maintenanceSchema);
