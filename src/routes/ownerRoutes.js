const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const ownerController = require('../controllers/ownerController');

const router = express.Router();
router.use(authenticate, authorize('OWNER'));
router.get('/profile', ownerController.getProfile);
router.put('/profile', ownerController.updateProfile);

module.exports = router;
