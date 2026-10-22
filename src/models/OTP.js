const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const otpSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['EMAIL', 'MOBILE'],
      required: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['LOGIN', 'VERIFY_EMAIL', 'VERIFY_MOBILE', 'RESET'],
      default: 'LOGIN',
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    expiresAt: { type: Date, required: true, index: true },
    used: { type: Boolean, default: false },
    ipAddress: String,
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ identifier: 1, purpose: 1, used: 1 });

otpSchema.statics.createOTP = async function (
  identifier,
  plainOtp,
  channel,
  purpose = 'LOGIN',
  ipAddress = null,
  expiryMinutes = 5
) {
  const id = String(identifier).toLowerCase().trim();
  await this.updateMany({ identifier: id, purpose, used: false }, { $set: { used: true } });

  const otpHash = await bcrypt.hash(String(plainOtp), 10);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  return this.create({
    identifier: id,
    channel,
    otpHash,
    purpose,
    expiresAt,
    ipAddress,
  });
};

otpSchema.methods.verify = async function (plainOtp) {
  if (this.used) return { valid: false, reason: 'OTP_ALREADY_USED' };
  if (this.expiresAt < new Date()) return { valid: false, reason: 'OTP_EXPIRED' };
  if (this.attempts >= this.maxAttempts) return { valid: false, reason: 'MAX_ATTEMPTS' };

  this.attempts += 1;
  await this.save();

  const match = await bcrypt.compare(String(plainOtp), this.otpHash);
  if (!match) return { valid: false, reason: 'INVALID_OTP' };

  this.used = true;
  await this.save();
  return { valid: true };
};

module.exports = mongoose.model('OTP', otpSchema);
