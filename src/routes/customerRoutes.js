const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const CustomerProfile = require('../models/CustomerProfile');

const router = express.Router();

router.get('/profile', authenticate, authorize('CUSTOMER'), async (req, res, next) => {
  try {
    let profile = await CustomerProfile.findOne({
      user: req.user._id,
    });

    if (!profile) {
      profile = await CustomerProfile.create({
        user: req.user._id,
      });
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', authenticate, authorize('CUSTOMER'), async (req, res, next) => {
  try {
    const allowed = [
      'name', 'shopName', 'mobile', 'address', 'profilePhoto',
      'preferredLanguage',
    ];

    const updates = {};

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates, $setOnInsert: { user: req.user._id } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

module.exports = router;