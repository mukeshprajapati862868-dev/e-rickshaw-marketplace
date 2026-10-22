
const asyncHandler = require('../utils/asyncHandler');
const paymentService = require('../services/paymentService');

const createOrder = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;

  if (!bookingId) {
    return res.status(400).json({
      success: false,
      message: 'bookingId required',
    });
  }

  const data = await paymentService.createDeliveryOrder(
    bookingId,
    req.user._id
  );

  res.json({
    success: true,
    data,
  });
});

const verifyPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    bookingId,
  } = req.body;

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature ||
    !bookingId
  ) {
    return res.status(400).json({
      success: false,
      message: 'Missing payment verification fields',
    });
  }

  const data = await paymentService.verifyPayment({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    bookingId,
    userId: req.user._id,
  });

  res.json({
    success: true,
    data,
  });
});

const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];

  // app.js uses express.raw() for this endpoint.
  // Never JSON.stringify a parsed body to verify the signature.
  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({
      success: false,
      message: 'Raw webhook body is required',
    });
  }

  const result = await paymentService.handleWebhook(
    req.body,
    signature
  );

  res.status(200).json(result);
});

module.exports = {
  createOrder,
  verifyPayment,
  webhook,
};
