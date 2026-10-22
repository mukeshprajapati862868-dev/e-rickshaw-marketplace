const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const vehicleController = require('../controllers/vehicleController');

const router = express.Router();

// Public / authenticated search
router.get('/search', authenticate, vehicleController.search);
router.get('/:id', authenticate, vehicleController.getById);

// Owner
router.post('/', authenticate, authorize('OWNER'), vehicleController.create);
router.put('/:id', authenticate, authorize('OWNER'), vehicleController.update);
router.patch('/:id/availability', authenticate, authorize('OWNER'), vehicleController.toggleAvailability);
router.get('/owner/my', authenticate, authorize('OWNER'), vehicleController.myVehicles);

module.exports = router;
