const express = require('express');
const { authenticate } = require('../middleware/auth');
const complaintController = require('../controllers/complaintController');

const router = express.Router();
router.use(authenticate);
router.post('/', complaintController.create);
router.get('/my', complaintController.myComplaints);

module.exports = router;
