const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// CUSTOMER = shopkeeper / sender; DRIVER; ADMIN; OWNER kept for legacy lease module
const ROLES = ['CUSTOMER', 'DRIVER', 'ADMIN', 'OWNER'];

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      sparse: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    mobile: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Invalid Indian mobile number'],
    },
    role: {
      type: String,
      enum: ROLES,
      required: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    isEmailVerified: { type: Boolean, default: false },
    isMobileVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    blockReason: String,
    language: {
      type: String,
      enum: ['en', 'hi'],
      default: 'hi',
    },
    lastLoginAt: Date,
    refreshTokens: [
      {
        token: String,
        expiresAt: Date,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    fcmTokens: [String],
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// At least email or mobile required
userSchema.pre('validate', function (next) {
  if (!this.email && !this.mobile) {
    return next(new Error('Either email or mobile is required'));
  }
  next();
});


userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ isBlocked: 1 });

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
