const express = require('express');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { getMyWeekProgress } = require('../services/rewardService');

const router = express.Router();
router.use(authenticate);

router.get('/my-week', asyncHandler(async (req, res) => {
  const role = req.user.role === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';
  const data = await getMyWeekProgress(req.user._id, role);
  res.json({ success: true, data });
}));

module.exports = router;
