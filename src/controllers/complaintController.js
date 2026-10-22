const Complaint = require('../models/Complaint');
const asyncHandler = require('../utils/asyncHandler');
const { generateId } = require('../utils/helpers');

const create = asyncHandler(async (req, res) => {
  const complaint = await Complaint.create({
    ticketId: generateId('CMP'),
    raisedBy: req.user._id,
    ...req.body,
  });
  res.status(201).json({ success: true, data: complaint });
});

const myComplaints = asyncHandler(async (req, res) => {
  const list = await Complaint.find({ raisedBy: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: list });
});

module.exports = { create, myComplaints };
