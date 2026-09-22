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

// Applies a subscription's billing period + status to a user document. Shared
// by the checkout-completed and subscription-updated webhook handlers so both
// paths keep `isPremium` / `premiumExpiresAt` in sync the same way.
const applySubscriptionToUser = (user, subscription, membershipType) => {
  const active = ['active', 'trialing'].includes(subscription.status);
  user.isPremium = active;
  user.membershipType = active ? membershipType || user.membershipType : '';
  user.stripeSubscriptionId = subscription.id;
  user.premiumExpiresAt = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
};

// -------------------------------------------------------------------------
// Create a Stripe Checkout Session for a recurring (monthly) membership.
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
    const userId = String(req.body.userData._id);

    const sessionParams = {
      mode: 'subscription',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: amount,
            recurring: { interval: 'month' },
            product_data: {
              name: `Tinder ${membershipType} membership`,
              description: 'Connect to your friends and have a chat.',
            },
          },
        },
      ],
      // Metadata is echoed back to us on the webhook. Values must be strings.
      metadata: {
        userId,
        membershipType,
        firstName,
        lastName,
        email,
        benefits: JSON.stringify(benefits),
      },
      // Also stamp the subscription itself, so subscription-level webhook
      // events (renewal/cancellation) can find the user without a lookup.
      subscription_data: {
        metadata: { userId, membershipType },
      },
      success_url: `${FRONTEND_URL}/premium?payment=success`,
      cancel_url: `${FRONTEND_URL}/premium?payment=cancelled`,
    };

    // Reuse the existing Stripe Customer if this user has one, so repeat
    // subscriptions/cancellations stay under a single Customer object.
    if (req.body.userData.stripeCustomerId) {
      sessionParams.customer = req.body.userData.stripeCustomerId;
    } else {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Persist the pending order.
    const payment = new Payment({
      orderId: session.id,
      amount,
      currency: CURRENCY,
      receiptId: session.id,
      status: session.payment_status, // 'unpaid' until the webhook confirms
      notes: { firstName, lastName, email, membershipType, benefits },
      userId,
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
// Cancel the current user's subscription at the end of the paid period.
// -------------------------------------------------------------------------
paymentRouter.post('/payment/cancel', authentication, async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(503).json({ message: 'Payments are not configured.' });
  }

  try {
    const user = req.body.userData;
    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ message: 'No active subscription found.' });
    }

    const subscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );

    res.json({
      message: 'Your subscription will end at the close of the current billing period.',
      premiumExpiresAt: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
    });
  } catch (error) {
    console.error('payment/cancel error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// -------------------------------------------------------------------------
// Stripe webhook: confirm the payment and keep the subscription lifecycle
// (renewal / cancellation / expiry) in sync with the user record.
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
    switch (event.type) {
      // First payment of a new subscription completed.
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;

        const payment = await Payment.findOne({ orderId: session.id });
        if (payment) {
          payment.status = session.payment_status;
          payment.paymentId = session.payment_intent || session.subscription;
          await payment.save();
        }

        const userId = session.metadata?.userId || payment?.userId;
        const membershipType =
          session.metadata?.membershipType || payment?.notes?.membershipType;

        if (userId && session.subscription && session.payment_status === 'paid') {
          const user = await User.findById(userId);
          if (user) {
            user.stripeCustomerId = session.customer || user.stripeCustomerId;
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription
            );
            applySubscriptionToUser(user, subscription, membershipType);
            await user.save();
          }
        }
        break;
      }

      // Renewal, plan change, or a scheduled (cancel_at_period_end) cancellation.
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;
        const user = userId
          ? await User.findById(userId)
          : await User.findOne({ stripeSubscriptionId: subscription.id });

        if (user) {
          applySubscriptionToUser(
            user,
            subscription,
            subscription.metadata?.membershipType
          );
          await user.save();
        }
        break;
      }

      // Subscription fully ended (immediate cancel, or period end reached).
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;
        const user = userId
          ? await User.findById(userId)
          : await User.findOne({ stripeSubscriptionId: subscription.id });

        if (user) {
          user.isPremium = false;
          user.membershipType = '';
          user.stripeSubscriptionId = null;
          user.premiumExpiresAt = null;
          await user.save();
        }
        break;
      }

      default:
        break;
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
