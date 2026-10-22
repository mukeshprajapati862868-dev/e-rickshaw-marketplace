const express = require('express');
const { authenticate } = require('../middleware/auth');
const addressController = require('../controllers/addressController');

const router = express.Router();
router.use(authenticate);
router.get('/', addressController.list);
router.post('/', addressController.create);
router.delete('/:id', addressController.remove);

module.exports = router;
