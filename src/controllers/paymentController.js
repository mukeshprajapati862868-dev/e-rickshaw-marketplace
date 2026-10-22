const asyncHandler = require('../utils/asyncHandler');
const paymentService = require('../services/paymentService');

const createOrder = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId) {
    return res.status(400).json({ success: false, message: 'bookingId required' });
  }
  const data = await paymentService.createDeliveryOrder(bookingId, req.user._id);
  res.json({ success: true, data });
});

const verifyPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    bookingId,
  } = req.body;

  const data = await paymentService.verifyPayment({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    bookingId,
    userId: req.user._id,
  });

  res.json({ success: true, data });
});

const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  // raw body may be needed — express.json already parsed; for prod use express.raw on this route
  const result = await paymentService.handleWebhook(
    JSON.stringify(req.body),
    signature
  );
  res.json(result);
});

module.exports = { createOrder, verifyPayment, webhook };
