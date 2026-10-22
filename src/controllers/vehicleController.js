const Vehicle = require('../models/Vehicle');
const Commission = require('../models/Commission');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { getRentForDuration, calculatePricing, maskRegistration } = require('../utils/helpers');
const config = require('../config');

const getActiveCommission = async () => {
  const c = await Commission.findOne({ isActive: true }).sort({ effectiveFrom: -1 });
  return c ? c.percent : config.platform.commissionPercent;
};

const search = asyncHandler(async (req, res) => {
  const {
    lat,
    lng,
    maxDistanceKm = 25,
    maxBudget,
    durationDays,
    batteryRequired,
    maxDeposit,
    city,
    type,
    page = 1,
    limit = 20,
  } = req.query;

  const filter = {
    isActive: true,
    'availability.status': 'AVAILABLE',
    'verification.status': 'APPROVED',
  };

  if (type) filter.type = type;
  if (city) filter['location.city'] = new RegExp(city, 'i');
  if (batteryRequired === 'true') filter['battery.included'] = true;
  if (maxDeposit) filter.securityDeposit = { $lte: Number(maxDeposit) };

  let query = Vehicle.find(filter).populate('owner', 'email');

  if (lat && lng) {
    query = Vehicle.find({
      ...filter,
      'location.coordinates': {
        $near: {
          $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
          $maxDistance: Number(maxDistanceKm) * 1000,
        },
      },
    }).populate('owner', 'email');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const vehicles = await query.skip(skip).limit(Number(limit)).lean();
  const commissionPercent = await getActiveCommission();

  const results = vehicles.map((v) => {
    const days = durationDays ? Number(durationDays) : 1;
    const baseRent = getRentForDuration(v, days);
    let pricing = null;
    if (baseRent != null) {
      pricing = calculatePricing({
        baseRent,
        securityDeposit: v.securityDeposit || 0,
        commissionPercent,
      });
      if (maxBudget && pricing.baseRent / days > Number(maxBudget)) {
        return null;
      }
    }
    return {
      ...v,
      registrationNumber: maskRegistration(v.registrationNumber),
      estimatedPricing: pricing,
      durationDays: days,
    };
  }).filter(Boolean);

  res.json({
    success: true,
    data: {
      vehicles: results,
      page: Number(page),
      limit: Number(limit),
      count: results.length,
    },
  });
});

const getById = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id)
    .populate('owner', 'email')
    .lean();
  if (!vehicle || !vehicle.isActive) {
    throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
  }

  const commissionPercent = await getActiveCommission();
  const tiers = [1, 7, 15, 30, 90].map((days) => {
    const baseRent = getRentForDuration(vehicle, days);
    if (baseRent == null) return null;
    return {
      days,
      pricing: calculatePricing({
        baseRent,
        securityDeposit: vehicle.securityDeposit || 0,
        commissionPercent,
      }),
    };
  }).filter(Boolean);

  res.json({
    success: true,
    data: {
      ...vehicle,
      registrationNumber: maskRegistration(vehicle.registrationNumber),
      pricingTiers: tiers,
    },
  });
});

const create = asyncHandler(async (req, res) => {
  const data = {
    ...req.body,
    owner: req.user._id,
    verification: { status: 'PENDING' },
    availability: { status: 'UNAVAILABLE', instantBooking: false },
  };
  const vehicle = await Vehicle.create(data);
  res.status(201).json({ success: true, data: vehicle });
});

const update = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findOne({ _id: req.params.id, owner: req.user._id });
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

  const allowed = [
    'brand', 'model', 'manufacturingYear', 'photos', 'battery', 'location',
    'rent', 'securityDeposit', 'features', 'description',
  ];
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) vehicle[k] = req.body[k];
  });
  await vehicle.save();
  res.json({ success: true, data: vehicle });
});

const toggleAvailability = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findOne({ _id: req.params.id, owner: req.user._id });
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
  if (vehicle.verification.status !== 'APPROVED') {
    throw new AppError('Only approved vehicles can change availability', 400, 'NOT_APPROVED');
  }

  const { status } = req.body;
  if (!['AVAILABLE', 'UNAVAILABLE', 'MAINTENANCE'].includes(status)) {
    throw new AppError('Invalid status', 400, 'INVALID_STATUS');
  }
  vehicle.availability.status = status;
  await vehicle.save();
  res.json({ success: true, data: vehicle });
});

const myVehicles = asyncHandler(async (req, res) => {
  const vehicles = await Vehicle.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: vehicles });
});

module.exports = {
  search,
  getById,
  create,
  update,
  toggleAvailability,
  myVehicles,
};
