const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const merchantController = require('../controllers/merchantController');

const router = express.Router();

router.get('/plans', authenticate, merchantController.listPlans);
router.post('/subscribe', authenticate, authorize('CUSTOMER'), merchantController.subscribe);
router.get('/my', authenticate, merchantController.mySubscription);
router.patch(
  '/:id/activate',
  authenticate,
  authorize('ADMIN'),
  merchantController.activateSubscription
);
router.post('/seed-plans', authenticate, authorize('ADMIN'), merchantController.seedDefaultPlans);

module.exports = router;
