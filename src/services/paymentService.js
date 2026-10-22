
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
 * Create Razorpay order for a delivery booking.
 */
async function createDeliveryOrder(bookingId, userId) {
  const booking = await DeliveryBooking.findById(bookingId);

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  if (booking.customer.toString() !== userId.toString()) {
    throw new AppError('Forbidden', 403);
  }

  if (booking.payment.status === 'PAID') {
    throw new AppError('Already paid', 400);
  }

  const amountPaise = Math.round(
    (booking.fare?.totalPayable || 0) * 100
  );

  if (amountPaise < 100) {
    throw new AppError('Invalid amount', 400);
  }

  const rzp = getRazorpay();

  if (!rzp) {
    if (config.env === 'production') {
      throw new AppError('Payment gateway not configured', 503);
    }

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
 * Verify Razorpay Checkout signature and confirm payment
 * by retrieving the payment from Razorpay.
 */
async function verifyPayment({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  bookingId,
  userId,
}) {
  if (
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature ||
    !bookingId
  ) {
    throw new AppError('Missing payment verification fields', 400);
  }

  const booking = await DeliveryBooking.findById(bookingId);

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  if (booking.customer.toString() !== userId.toString()) {
    throw new AppError('Forbidden', 403);
  }

  if (booking.payment.razorpayOrderId !== razorpayOrderId) {
    throw new AppError('Order does not match booking', 400);
  }

  const secret = config.razorpay.keySecret;
  const rzp = getRazorpay();

  if (secret && rzp) {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest();

    let supplied;

    try {
      supplied = Buffer.from(razorpaySignature, 'hex');
    } catch {
      throw new AppError('Invalid payment signature', 400);
    }

    if (
      supplied.length !== expected.length ||
      !crypto.timingSafeEqual(expected, supplied)
    ) {
      throw new AppError(
        'Invalid payment signature',
        400,
        'INVALID_SIGNATURE'
      );
    }

    // Verify status and amount directly with Razorpay.
    const remotePayment = await rzp.payments.fetch(razorpayPaymentId);

    if (
      remotePayment.order_id !== razorpayOrderId ||
      remotePayment.status !== 'captured'
    ) {
      throw new AppError('Payment is not captured', 400);
    }

    if (
      remotePayment.amount !==
      Math.round(Number(booking.fare.totalPayable) * 100)
    ) {
      throw new AppError('Payment amount mismatch', 400);
    }
  } else if (
    config.env !== 'production' &&
    String(razorpayOrderId).startsWith('order_dev_')
  ) {
    // Local development only; never enable fake payments in production.
  } else {
    throw new AppError('Payment gateway not configured', 503);
  }

  const payment = await Payment.findOne({
    'gateway.orderId': razorpayOrderId,
  });

  if (!payment) {
    throw new AppError('Payment record not found', 404);
  }

  if (payment.status === 'SUCCESS') {
    return {
      alreadyPaid: true,
      booking,
      payment,
    };
  }

  payment.status = 'SUCCESS';
  payment.gateway.paymentId = razorpayPaymentId;
  payment.gateway.signature = razorpaySignature;
  payment.gateway.status = 'PAID';
  await payment.save();

  booking.payment.status = 'PAID';
  booking.payment.razorpayPaymentId = razorpayPaymentId;
  booking.payment.paidAt = new Date();

  if (booking.status === 'DRAFT') {
    booking.status = 'SEARCHING';
  }

  await booking.save();

  logger.info(`Payment verified for booking ${booking.bookingId}`);

  return {
    alreadyPaid: false,
    booking,
    payment,
  };
}

/**
 * Handle Razorpay webhook events.
 * rawBody must be the original HTTP request body as a Buffer or string.
 */
async function handleWebhook(rawBody, signature) {
  const secret = config.razorpay.webhookSecret;

  // Fail closed: never accept unsigned webhooks.
  if (!secret) {
    logger.error('Razorpay webhook secret is not configured');

    throw new AppError(
      'Webhook is not configured',
      503
    );
  }

  if (!signature) {
    throw new AppError('Missing webhook signature', 400);
  }

  if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') {
    throw new AppError('Invalid raw webhook body', 400);
  }

  const bodyBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(rawBody, 'utf8');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(bodyBuffer)
    .digest();

  let supplied;

  try {
    supplied = Buffer.from(signature, 'hex');
  } catch {
    throw new AppError('Invalid webhook signature', 400);
  }

  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(expected, supplied)
  ) {
    throw new AppError('Invalid webhook signature', 400);
  }

  let event;

  try {
    event = JSON.parse(bodyBuffer.toString('utf8'));
  } catch {
    throw new AppError('Invalid webhook JSON', 400);
  }

  const eventId = event.event;
  const payload = event.payload?.payment?.entity;

  if (!eventId) {
    throw new AppError('Missing webhook event type', 400);
  }

  if (
    eventId === 'payment.captured' &&
    payload
  ) {
    const orderId = payload.order_id;
    const paymentId = payload.id;

    if (!orderId || !paymentId) {
      throw new AppError('Incomplete captured payment payload', 400);
    }

    const payment = await Payment.findOne({
      'gateway.orderId': orderId,
    });

    if (payment && payment.status !== 'SUCCESS') {
      // Do not mark a payment successful if its amount differs.
      const expectedPaise = Math.round(Number(payment.amount) * 100);

      if (
        Number(payload.amount) !== expectedPaise ||
        payload.currency !== 'INR'
      ) {
        logger.error(`Webhook amount mismatch for order ${orderId}`);
        throw new AppError('Payment amount mismatch', 400);
      }

      payment.status = 'SUCCESS';
      payment.gateway.paymentId = paymentId;
      payment.gateway.status = 'PAID';
      payment.gateway.rawResponse = payload;
      await payment.save();
    }

    const booking = await DeliveryBooking.findOne({
      'payment.razorpayOrderId': orderId,
    });

    if (booking) {
      const bookingPaise = Math.round(
        Number(booking.fare?.totalPayable || 0) * 100
      );

      if (
        Number(payload.amount) !== bookingPaise ||
        payload.currency !== 'INR'
      ) {
        logger.error(`Booking payment amount mismatch for order ${orderId}`);
        throw new AppError('Booking payment amount mismatch', 400);
      }

      if (booking.payment.status !== 'PAID') {
        booking.payment.status = 'PAID';
        booking.payment.razorpayPaymentId = paymentId;
        booking.payment.paidAt = new Date();

        if (booking.status === 'DRAFT') {
          booking.status = 'SEARCHING';
        }

        await booking.save();
      }
    }
  }

  if (
    eventId === 'payment.failed' &&
    payload
  ) {
    const orderId = payload.order_id;

    if (orderId) {
      const payment = await Payment.findOne({
        'gateway.orderId': orderId,
      });

      // Do not overwrite a payment already marked successful.
      if (payment && payment.status !== 'SUCCESS') {
        payment.status = 'FAILED';
        payment.gateway.paymentId = payload.id;
        payment.gateway.status = 'FAILED';
        payment.gateway.rawResponse = payload;
        await payment.save();
      }
    }
  }

  // Acknowledge valid events, including events not handled here.
  return {
    received: true,
    event: eventId,
  };
}

module.exports = {
  getRazorpay,
  createDeliveryOrder,
  verifyPayment,
  handleWebhook,
};
