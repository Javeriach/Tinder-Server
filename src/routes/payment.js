const express = require('express');
const paymentRouter = express.Router();
const User = require('../models/User');
const authentication = require('../MiddleWares/auth');
const membership_Plans_Price = require('../helpers/constants');
const Payment = require('../models/payment.js');
const { getStripeClient } = require('../helpers/stripeInstance');

// Where Stripe sends the user back after checkout.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// Stripe uses lowercase currency codes. Override with PAYMENT_CURRENCY if your
// Stripe account does not have PKR enabled (e.g. set it to "usd").
const CURRENCY = (process.env.PAYMENT_CURRENCY || 'pkr').toLowerCase();

// -------------------------------------------------------------------------
// Create a Stripe Checkout Session for a membership purchase.
// -------------------------------------------------------------------------
paymentRouter.post('/payment/create', authentication, async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(503).json({ message: 'Payments are not configured.' });
  }

  const { firstName, lastName, email } = req.body.userData;
  const membershipType = req?.body?.membershipType;
  const benefits = req?.body?.benefits;

  try {
    if (!membershipType) throw new Error('Membership type not defined.');
    if (!membership_Plans_Price[membershipType])
      throw new Error('Invalid membership type.');
    if (!benefits?.length) throw new Error('Benefits are not defined.');

    // Amount in the smallest currency unit (e.g. paisa / cents).
    const amount = membership_Plans_Price[membershipType] * 100;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: amount,
            product_data: {
              name: `Tinder ${membershipType} membership`,
              description: 'Connect to your friends and have a chat.',
            },
          },
        },
      ],
      // Metadata is echoed back to us on the webhook. Values must be strings.
      metadata: {
        userId: String(req.body.userData._id),
        membershipType,
        firstName,
        lastName,
        email,
        benefits: JSON.stringify(benefits),
      },
      success_url: `${FRONTEND_URL}/premium?payment=success`,
      cancel_url: `${FRONTEND_URL}/premium?payment=cancelled`,
    });

    // Persist the pending order.
    const payment = new Payment({
      orderId: session.id,
      amount,
      currency: CURRENCY,
      receiptId: session.id,
      status: session.payment_status, // 'unpaid' until the webhook confirms
      notes: { firstName, lastName, email, membershipType, benefits },
      userId: req.body.userData._id,
    });

    const savedOrderDetails = await payment.save();

    // Frontend redirects the browser to `url`.
    res.json({ ...savedOrderDetails.toJSON(), url: session.url });
  } catch (error) {
    console.error('payment/create error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// -------------------------------------------------------------------------
// Stripe webhook: confirm the payment and upgrade the user.
// `express.raw` is applied to this path in index.js so `req.body` is a Buffer.
// -------------------------------------------------------------------------
paymentRouter.post('/payment/webhook', async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send('Webhook not configured.');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.get('stripe-signature'),
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object;

      const payment = await Payment.findOne({ orderId: session.id });
      if (payment) {
        payment.status = session.payment_status;
        payment.paymentId = session.payment_intent;
        await payment.save();
      }

      const userId = session.metadata?.userId || payment?.userId;
      const membershipType =
        session.metadata?.membershipType || payment?.notes?.membershipType;

      if (userId && session.payment_status === 'paid') {
        const user = await User.findById(userId);
        if (user) {
          user.isPremium = true;
          user.membershipType = membershipType;
          await user.save();
        }
      }
    }

    // Always acknowledge so Stripe stops retrying.
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error.message);
    res.status(500).json({ msg: error.message });
  }
});

// -------------------------------------------------------------------------
// Check whether the current user is premium.
// -------------------------------------------------------------------------
paymentRouter.get('/premium/verify', authentication, async (req, res) => {
  try {
    const user = req.body.userData.toJSON();
    res.json({ ...user });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

module.exports = paymentRouter;
