const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('DRIVER'), bookingController.createBooking);
router.get('/my', bookingController.listMyBookings);
router.patch('/:id/respond', authorize('OWNER'), bookingController.respondToBooking);

module.exports = router;
