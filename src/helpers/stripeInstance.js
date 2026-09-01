const Stripe = require('stripe');

// Lazily-created singleton Stripe client (built on first use, not at import
// time) so tests can set/unset STRIPE_SECRET_KEY and serverless cold starts
// don't pay the cost until a payment is actually processed.
let client;

/**
 * Returns a shared Stripe client, or `null` when STRIPE_SECRET_KEY is not set.
 */
const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
};

/** Test helper: drop the cached client so the next call rebuilds it. */
const resetStripeClient = () => {
  client = undefined;
};

module.exports = { getStripeClient, resetStripeClient };
