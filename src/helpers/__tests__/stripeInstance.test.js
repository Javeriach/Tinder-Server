const test = require('node:test');
const assert = require('node:assert/strict');

const stripeInstance = require('../stripeInstance.js');

function withEnv(vars, fn) {
  const saved = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test('getStripeClient: null without STRIPE_SECRET_KEY, cached instance with it', () => {
  stripeInstance.resetStripeClient();

  withEnv({ STRIPE_SECRET_KEY: undefined }, () => {
    assert.equal(stripeInstance.getStripeClient(), null);
  });

  withEnv({ STRIPE_SECRET_KEY: 'sk_test_dummy' }, () => {
    const a = stripeInstance.getStripeClient();
    const b = stripeInstance.getStripeClient();
    assert.ok(a, 'client should be created');
    assert.equal(typeof a.checkout.sessions.create, 'function');
    assert.equal(a, b, 'client should be cached');
  });

  stripeInstance.resetStripeClient();
});
