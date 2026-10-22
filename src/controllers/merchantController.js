const MerchantPlan = require('../models/MerchantPlan');
const Subscription = require('../models/Subscription');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const listPlans = asyncHandler(async (req, res) => {
  const plans = await MerchantPlan.find({ isActive: true }).sort({ priceMonthly: 1 });
  res.json({ success: true, data: plans });
});

const subscribe = asyncHandler(async (req, res) => {
  const plan = await MerchantPlan.findById(req.body.planId);
  if (!plan || !plan.isActive) throw new AppError('Plan not found', 404);

  const startsAt = new Date();
  const endsAt = new Date();
  endsAt.setMonth(endsAt.getMonth() + 1);

  const sub = await Subscription.create({
    user: req.user._id,
    plan: plan._id,
    status: 'PENDING_PAYMENT',
    startsAt,
    endsAt,
    amountPaid: plan.priceMonthly,
  });

  res.status(201).json({
    success: true,
    data: sub,
    message: 'Subscription created. Complete payment to activate.',
  });
});

const mySubscription = asyncHandler(async (req, res) => {
  const sub = await Subscription.findOne({ user: req.user._id, status: 'ACTIVE' })
    .populate('plan')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: sub });
});

/** Admin activates after payment verification */
const activateSubscription = asyncHandler(async (req, res) => {
  const sub = await Subscription.findById(req.params.id);
  if (!sub) throw new AppError('Not found', 404);
  sub.status = 'ACTIVE';
  sub.razorpayPaymentId = req.body.razorpayPaymentId || sub.razorpayPaymentId;
  await sub.save();
  res.json({ success: true, data: sub });
});

const seedDefaultPlans = asyncHandler(async (req, res) => {
  const count = await MerchantPlan.countDocuments();
  if (count === 0) {
    await MerchantPlan.insertMany([
      {
        name: 'Starter',
        priceMonthly: 299,
        maxDeliveriesPerMonth: 30,
        discountPercent: 5,
        benefits: ['30 deliveries/month', '5% off fare'],
      },
      {
        name: 'Business',
        priceMonthly: 799,
        maxDeliveriesPerMonth: 100,
        discountPercent: 10,
        benefits: ['100 deliveries/month', '10% off fare', 'Priority support'],
      },
    ]);
  }
  const plans = await MerchantPlan.find({ isActive: true });
  res.json({ success: true, data: plans });
});

module.exports = {
  listPlans,
  subscribe,
  mySubscription,
  activateSubscription,
  seedDefaultPlans,
};
