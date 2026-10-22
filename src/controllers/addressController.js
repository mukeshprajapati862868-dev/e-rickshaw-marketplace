const Address = require('../models/Address');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const list = asyncHandler(async (req, res) => {
  const list = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
  res.json({ success: true, data: list });
});

const create = asyncHandler(async (req, res) => {
  const { line1, coordinates, label, name, phone, line2, landmark, city, pincode, isDefault } = req.body;
  if (!line1 || !coordinates?.length) {
    throw new AppError('line1 and coordinates [lng,lat] required', 400);
  }
  if (isDefault) {
    await Address.updateMany({ user: req.user._id }, { isDefault: false });
  }
  const addr = await Address.create({
    user: req.user._id,
    label: label || 'OTHER',
    name,
    phone,
    line1,
    line2,
    landmark,
    city: city || 'Lucknow',
    pincode,
    coordinates: { type: 'Point', coordinates },
    isDefault: !!isDefault,
  });
  res.status(201).json({ success: true, data: addr });
});

const remove = asyncHandler(async (req, res) => {
  const r = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!r) throw new AppError('Address not found', 404);
  res.json({ success: true, message: 'Deleted' });
});

module.exports = { list, create, remove };
