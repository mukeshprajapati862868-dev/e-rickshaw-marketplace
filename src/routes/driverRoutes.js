const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const driverController = require('../controllers/driverController');

const router = express.Router();
router.use(authenticate, authorize('DRIVER'));
router.get('/profile', driverController.getProfile);
router.put('/profile', driverController.updateProfile);

module.exports = router;
