const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', adminController.dashboard);
router.get('/vehicles', adminController.listVehiclesForReview);
router.patch('/vehicles/:id/review', adminController.reviewVehicle);
router.put('/commission', adminController.updateCommission);
router.get('/deliveries', adminController.listDeliveries);
router.get('/users', adminController.listUsers);
router.patch('/users/:id/block', adminController.blockUser);
router.get('/fare-rule', adminController.getFareRule);
router.put('/fare-rule', adminController.updateFareRule);
router.get('/rewards', adminController.listRewards);
router.patch('/rewards/:id', adminController.creditReward);

module.exports = router;
