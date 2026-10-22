require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const config = require('../src/config');
const User = require('../src/models/User');
const Commission = require('../src/models/Commission');
const FareRule = require('../src/models/FareRule');
const MerchantPlan = require('../src/models/MerchantPlan');

async function seed() {
  await mongoose.connect(config.mongodb.uri);
  console.log('Connected for seed');

  let admin = await User.findOne({ email: config.admin.email });
  if (!admin) {
    admin = await User.create({
      email: config.admin.email,
      role: 'ADMIN',
      isEmailVerified: true,
      isActive: true,
      name: 'Admin',
    });
    console.log('Admin created:', config.admin.email);
  } else {
    console.log('Admin exists');
  }

  const active = await Commission.findOne({ isActive: true });
  if (!active) {
    await Commission.create({ percent: 12, isActive: true });
    console.log('Default commission 12%');
  }

  const fare = await FareRule.findOne({ isActive: true });
  if (!fare) {
    await FareRule.create({
      name: 'lucknow-default',
      version: 1,
      isActive: true,
      baseFare: 40,
      perKmRate: 12,
      minFare: 50,
      platformCommissionPercent: 12,
      
    });
    console.log('Default fare rule created');
  }

  const planCount = await MerchantPlan.countDocuments();
  if (planCount === 0) {
    await MerchantPlan.insertMany([
      { name: 'Starter', priceMonthly: 299, maxDeliveriesPerMonth: 30, discountPercent: 5, benefits: ['30 deliveries/month', '5% off'] },
      { name: 'Business', priceMonthly: 799, maxDeliveriesPerMonth: 100, discountPercent: 10, benefits: ['100 deliveries/month', '10% off', 'Priority support'] },
    ]);
    console.log('Merchant plans seeded');
  }

  await mongoose.disconnect();
  console.log('Seed complete');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
