const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const deliveryController = require('../controllers/deliveryController');

const router = express.Router();

router.use(authenticate);

router.post('/estimate', authorize('CUSTOMER', 'ADMIN'), deliveryController.estimateFare);
router.post('/bookings', authorize('CUSTOMER'), deliveryController.createBooking);
router.get('/bookings/my', deliveryController.myBookings);
router.get('/bookings/:id', deliveryController.getBooking);
router.get('/requests', authorize('DRIVER'), deliveryController.nearbyRequests);
router.post('/bookings/:id/accept', authorize('DRIVER'), deliveryController.acceptBooking);
router.patch('/bookings/:id/status', deliveryController.updateStatus);
router.patch('/driver/online', authorize('DRIVER'), deliveryController.setOnlineStatus);
router.post('/bookings/:id/generate-proof-otp', authorize('DRIVER', 'ADMIN'), deliveryController.generateProofOtp);
router.post('/bookings/:id/verify-proof-otp', authorize('DRIVER', 'ADMIN'), deliveryController.verifyProofOtp);
router.get('/return-loads', authorize('DRIVER'), deliveryController.returnLoads);
router.post('/bookings/:id/backup-driver', authorize('ADMIN', 'DRIVER'), deliveryController.assignBackupDriver);
router.post('/bookings/:id/repeat', authorize('CUSTOMER'), deliveryController.repeatBooking);
router.post('/bookings/schedule', authorize('CUSTOMER'), deliveryController.scheduleBooking);

module.exports = router;
