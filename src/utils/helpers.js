const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const generateId = (prefix = '') => {
  const id = uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase();
  return prefix ? `${prefix}${id}` : id;
};

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

const calculatePricing = ({ baseRent, securityDeposit, commissionPercent, taxPercent = 0, gatewayPercent = 0 }) => {
  const platformFee = Math.round((baseRent * commissionPercent) / 100);
  const taxes = Math.round((baseRent * taxPercent) / 100);
  const gatewayCharges = Math.round(((baseRent + securityDeposit) * gatewayPercent) / 100);
  const totalAmount = baseRent + securityDeposit + platformFee + taxes + gatewayCharges;
  const ownerSettlement = baseRent - platformFee;

  return {
    baseRent,
    securityDeposit,
    platformFee,
    taxes,
    gatewayCharges,
    totalAmount,
    commissionPercent,
    ownerSettlement,
  };
};

const getRentForDuration = (vehicle, days) => {
  if (!vehicle || !vehicle.rent) return null;
  const { daily, weekly, fifteenDay, monthly, threeMonth } = vehicle.rent;

  if (days === 1 && daily != null) return daily;
  if (days === 7 && weekly != null) return weekly;
  if (days === 15 && fifteenDay != null) return fifteenDay;
  if (days === 30 && monthly != null) return monthly;
  if (days === 90 && threeMonth != null) return threeMonth;

  // Fallback: daily * days (or prorate from closest tier)
  if (daily != null) return daily * days;
  if (weekly != null) return Math.round((weekly / 7) * days);
  if (monthly != null) return Math.round((monthly / 30) * days);
  return null;
};

const maskRegistration = (reg) => {
  if (!reg || reg.length < 4) return reg || '';
  return `${reg.slice(0, 2)}**${reg.slice(-2)}`;
};

const daysBetween = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e - s) / (1000 * 60 * 60 * 24));
};

module.exports = {
  generateId,
  generateOTP,
  hashOTP,
  calculatePricing,
  getRentForDuration,
  maskRegistration,
  daysBetween,
};
