const express = require('express');
const { authenticate } = require('../middleware/auth');
const trackingController = require('../controllers/trackingController');

const router = express.Router();
router.use(authenticate);
router.post('/location', trackingController.updateLocation);
router.get('/booking/:id', trackingController.getBookingTracking);

module.exports = router;
