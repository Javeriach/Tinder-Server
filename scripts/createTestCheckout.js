/**
 * Manual smoke test for the Stripe payment integration.
 *
 * Usage:
 *   node scripts/createTestCheckout.js [gold|premium]
 *
 * Reads STRIPE_SECRET_KEY / PAYMENT_CURRENCY / FRONTEND_URL from .env.
 * Creates a real (test-mode) Checkout Session and prints the URL you can open
 * in a browser to complete a payment with card 4242 4242 4242 4242.
 */
require('dotenv').config();

const { getStripeClient } = require('../src/helpers/stripeInstance.js');
const membership_Plans_Price = require('../src/helpers/constants.js');

const membershipType = process.argv[2] || 'gold';
const currency = (process.env.PAYMENT_CURRENCY || 'pkr').toLowerCase();
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

(async () => {
  const stripe = getStripeClient();
  if (!stripe) {
    console.error('❌ STRIPE_SECRET_KEY is not set in .env');
    process.exitCode = 1;
    return;
  }
  if (!membership_Plans_Price[membershipType]) {
    console.error(`❌ Unknown membership type: ${membershipType}`);
    process.exitCode = 1;
    return;
  }

  const amount = membership_Plans_Price[membershipType] * 100;
  console.log(`Creating ${membershipType} checkout session (${amount} ${currency})...`);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: 'buyer@example.com',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amount,
            product_data: { name: `Tinder ${membershipType} membership` },
          },
        },
      ],
      metadata: { userId: 'test-user', membershipType },
      success_url: `${frontendUrl}/premium?payment=success`,
      cancel_url: `${frontendUrl}/premium?payment=cancelled`,
    });

    console.log('\n✅ Session created:', session.id);
    console.log('   status:', session.status, '| payment_status:', session.payment_status);
    console.log('\nOpen this URL to pay (test card 4242 4242 4242 4242, any future date / CVC):');
    console.log('  ' + session.url);
  } catch (err) {
    console.error('\n❌ FAILED:', err.message);
    process.exitCode = 1;
  }
})();
