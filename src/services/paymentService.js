const crypto = require('crypto');
const Razorpay = require('razorpay');
const config = require('../config');
const Payment = require('../models/Payment');
const DeliveryBooking = require('../models/DeliveryBooking');
const AppError = require('../utils/AppError');
const { generateId } = require('../utils/helpers');
const logger = require('../utils/logger');

let razorpayInstance = null;

function getRazorpay() {
  if (razorpayInstance) return razorpayInstance;
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    return null;
  }
  razorpayInstance = new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
  });
  return razorpayInstance;
}

/**
 * Create Razorpay order for a delivery booking
 */
async function createDeliveryOrder(bookingId, userId) {
  const booking = await DeliveryBooking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.customer.toString() !== userId.toString()) {
    throw new AppError('Forbidden', 403);
  }
  if (booking.payment.status === 'PAID') {
    throw new AppError('Already paid', 400);
  }

  const amountPaise = Math.round((booking.fare?.totalPayable || 0) * 100);
  if (amountPaise < 100) throw new AppError('Invalid amount', 400);

  const rzp = getRazorpay();
  if (!rzp) {
    // Dev mode without keys — create local pending payment
    const payment = await Payment.create({
      paymentId: generateId('PAY'),
      payer: userId,
      amount: booking.fare.totalPayable,
      type: 'BOOKING',
      breakdown: {
        total: booking.fare.totalPayable,
        baseRent: booking.fare.subtotal,
        platformFee: booking.fare.platformCommission,
      },
      gateway: {
        provider: 'RAZORPAY',
        status: 'CREATED',
        orderId: `order_dev_${Date.now()}`,
      },
      status: 'PENDING',
    });
    booking.payment.razorpayOrderId = payment.gateway.orderId;
    await booking.save();
    return {
      orderId: payment.gateway.orderId,
      amount: amountPaise,
      currency: 'INR',
      keyId: config.razorpay.keyId || 'rzp_test_not_configured',
      bookingId: booking._id,
      paymentId: payment.paymentId,
      devMode: true,
    };
  }

  const order = await rzp.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: booking.bookingId,
    notes: {
      bookingId: booking._id.toString(),
      customerId: userId.toString(),
    },
  });

  const payment = await Payment.create({
    paymentId: generateId('PAY'),
    payer: userId,
    amount: booking.fare.totalPayable,
    type: 'BOOKING',
    breakdown: {
      total: booking.fare.totalPayable,
      baseRent: booking.fare.subtotal,
      platformFee: booking.fare.platformCommission,
    },
    gateway: {
      provider: 'RAZORPAY',
      orderId: order.id,
      status: 'CREATED',
    },
    status: 'PENDING',
  });

  booking.payment.razorpayOrderId = order.id;
  await booking.save();

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: config.razorpay.keyId,
    bookingId: booking._id,
    paymentId: payment.paymentId,
  };
}

/**
 * Verify Razorpay payment signature after checkout
 */
async function verifyPayment({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  bookingId,
  userId,
}) {
  const booking = await DeliveryBooking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.customer.toString() !== userId.toString()) {
    throw new AppError('Forbidden', 403);
  }

  const secret = config.razorpay.keySecret;
  if (secret) {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    if (expected !== razorpaySignature) {
      throw new AppError('Invalid payment signature', 400, 'INVALID_SIGNATURE');
    }
  } else if (!String(razorpayOrderId).startsWith('order_dev_')) {
    throw new AppError('Payment gateway not configured', 503);
  }

  // Idempotent update
  const payment = await Payment.findOne({ 'gateway.orderId': razorpayOrderId });
  if (payment && payment.status === 'SUCCESS') {
    return { alreadyPaid: true, booking, payment };
  }

  if (payment) {
    payment.status = 'SUCCESS';
    payment.gateway.paymentId = razorpayPaymentId;
    payment.gateway.signature = razorpaySignature;
    payment.gateway.status = 'PAID';
    await payment.save();
  }

  booking.payment.status = 'PAID';
  booking.payment.razorpayPaymentId = razorpayPaymentId;
  booking.payment.paidAt = new Date();
  if (booking.status === 'DRAFT') booking.status = 'SEARCHING';
  await booking.save();

  logger.info(`Payment verified for booking ${booking.bookingId}`);
  return { alreadyPaid: false, booking, payment };
}

/**
 * Webhook handler — verify signature, update payment
 */
async function handleWebhook(rawBody, signature) {
  const secret = config.razorpay.webhookSecret;
  if (secret) {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    if (expected !== signature) {
      throw new AppError('Invalid webhook signature', 400);
    }
  }

  const event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  const eventId = event.event;
  const payload = event.payload?.payment?.entity;

  if (eventId === 'payment.captured' && payload) {
    const orderId = payload.order_id;
    const paymentId = payload.id;
    const payment = await Payment.findOne({ 'gateway.orderId': orderId });
    if (payment && payment.status !== 'SUCCESS') {
      payment.status = 'SUCCESS';
      payment.gateway.paymentId = paymentId;
      payment.gateway.status = 'PAID';
      payment.gateway.rawResponse = payload;
      await payment.save();
    }
    await DeliveryBooking.updateOne(
      { 'payment.razorpayOrderId': orderId },
      {
        $set: {
          'payment.status': 'PAID',
          'payment.razorpayPaymentId': paymentId,
          'payment.paidAt': new Date(),
        },
      }
    );
  }

  return { received: true };
}

module.exports = {
  getRazorpay,
  createDeliveryOrder,
  verifyPayment,
  handleWebhook,
};
