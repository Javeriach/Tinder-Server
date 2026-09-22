const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

// ---------------------------------------------------------------------------
// Integration tests for the Stripe payment routes. The REAL router is mounted;
// auth, the Mongoose models and the Stripe SDK are stubbed via the require
// cache so the suite runs offline.
// ---------------------------------------------------------------------------

process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.PAYMENT_CURRENCY = 'usd';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

const state = {
  sessionCreateArgs: null,
  constructEventArg: null,
  savedPayment: null,
  paymentRow: null, // what Payment.findOne returns
  users: {},
  subscriptionRetrieveArg: null,
  subscriptionUpdateArgs: null,
  nextSubscription: null,
};

function stub(relFromRoute, exports) {
  const id = require.resolve(path.join(__dirname, '..', relFromRoute));
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

// --- auth: inject a fake logged-in user ---
let currentAuthUser = null;
stub('../MiddleWares/auth.js', (req, _res, next) => {
  req.body.userData = currentAuthUser || {
    _id: 'user-1',
    firstName: 'Alice',
    lastName: 'A',
    email: 'alice@example.com',
  };
  next();
});

// --- Payment model ---
function Payment(doc) {
  Object.assign(this, doc);
}
Payment.prototype.save = async function save() {
  state.savedPayment = this;
  return {
    ...this,
    _id: 'pay-1',
    toJSON() {
      return { ...this, _id: 'pay-1' };
    },
  };
};
Payment.findOne = async () => state.paymentRow;
stub('../models/payment.js', Payment);

// --- User model ---
stub('../models/User.js', {
  findById: async (id) => state.users[id] || null,
  findOne: async (query) => {
    if (query?.stripeSubscriptionId) {
      return (
        Object.values(state.users).find(
          (u) => u.stripeSubscriptionId === query.stripeSubscriptionId
        ) || null
      );
    }
    return null;
  },
});

// --- Stripe SDK ---
const fakeStripe = {
  checkout: {
    sessions: {
      create: async (args) => {
        state.sessionCreateArgs = args;
        return { id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123', payment_status: 'unpaid' };
      },
    },
  },
  subscriptions: {
    retrieve: async (id) => {
      state.subscriptionRetrieveArg = id;
      return state.nextSubscription;
    },
    update: async (id, args) => {
      state.subscriptionUpdateArgs = { id, ...args };
      return state.nextSubscription;
    },
  },
  webhooks: {
    constructEvent: (body /* , sig, secret */) => {
      state.constructEventArg = body;
      return state._nextEvent;
    },
  },
};
stub('../helpers/stripeInstance.js', {
  getStripeClient: () => (state._stripeConfigured === false ? null : fakeStripe),
  resetStripeClient: () => {},
});

const paymentRouter = require('../payment.js');

function startServer() {
  const app = express();
  app.use('/payment/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  app.use('/', paymentRouter);
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function withServer(fn) {
  const server = await startServer();
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test.beforeEach(() => {
  state.sessionCreateArgs = null;
  state.constructEventArg = null;
  state.savedPayment = null;
  state.paymentRow = null;
  state.users = {};
  state._stripeConfigured = true;
  state._nextEvent = null;
  state.subscriptionRetrieveArg = null;
  state.subscriptionUpdateArgs = null;
  state.nextSubscription = null;
  currentAuthUser = null;
});

// ---------------------------------------------------------------------------
// POST /payment/create
// ---------------------------------------------------------------------------

test('create: builds a recurring Stripe Checkout Session and returns its url', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipType: 'gold', benefits: ['Chat access'] }),
    });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.url, 'https://checkout.stripe.com/c/pay/cs_test_123');
    assert.equal(json.orderId, 'cs_test_123');

    const args = state.sessionCreateArgs;
    assert.equal(args.mode, 'subscription');
    assert.equal(args.customer_email, 'alice@example.com');
    assert.equal(args.line_items[0].price_data.currency, 'usd');
    assert.equal(args.line_items[0].price_data.unit_amount, 400 * 100);
    assert.equal(args.line_items[0].price_data.recurring.interval, 'month');
    assert.equal(args.metadata.userId, 'user-1');
    assert.equal(args.metadata.membershipType, 'gold');
    assert.equal(args.metadata.benefits, JSON.stringify(['Chat access']));
    assert.equal(args.subscription_data.metadata.userId, 'user-1');
    assert.equal(args.subscription_data.metadata.membershipType, 'gold');
    assert.equal(args.success_url, 'http://localhost:5173/premium?payment=success');
    assert.equal(args.cancel_url, 'http://localhost:5173/premium?payment=cancelled');

    // Pending order persisted in the Payment collection.
    assert.equal(state.savedPayment.orderId, 'cs_test_123');
    assert.equal(state.savedPayment.amount, 40000);
    assert.equal(state.savedPayment.notes.membershipType, 'gold');
  });
});

test('create: reuses an existing Stripe customer instead of customer_email', async () => {
  currentAuthUser = {
    _id: 'user-1',
    firstName: 'Alice',
    lastName: 'A',
    email: 'alice@example.com',
    stripeCustomerId: 'cus_existing',
  };
  await withServer(async (base) => {
    await fetch(`${base}/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipType: 'gold', benefits: ['x'] }),
    });
    assert.equal(state.sessionCreateArgs.customer, 'cus_existing');
    assert.equal(state.sessionCreateArgs.customer_email, undefined);
  });
});

test('create: premium plan uses the premium price', async () => {
  await withServer(async (base) => {
    await fetch(`${base}/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipType: 'premium', benefits: ['x'] }),
    });
    assert.equal(state.sessionCreateArgs.line_items[0].price_data.unit_amount, 700 * 100);
  });
});

test('create: rejects a missing membership type', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benefits: ['x'] }),
    });
    assert.equal(res.status, 500);
    assert.match((await res.json()).message, /Membership type not defined/);
  });
});

test('create: rejects an unknown membership type', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipType: 'diamond', benefits: ['x'] }),
    });
    assert.equal(res.status, 500);
    assert.match((await res.json()).message, /Invalid membership type/);
  });
});

test('create: rejects empty benefits', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipType: 'gold', benefits: [] }),
    });
    assert.equal(res.status, 500);
    assert.match((await res.json()).message, /Benefits are not defined/);
  });
});

test('create: 503 when Stripe is not configured', async () => {
  await withServer(async (base) => {
    state._stripeConfigured = false;
    const res = await fetch(`${base}/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipType: 'gold', benefits: ['x'] }),
    });
    assert.equal(res.status, 503);
  });
});

// ---------------------------------------------------------------------------
// POST /payment/cancel
// ---------------------------------------------------------------------------

test('cancel: sets cancel_at_period_end on the user subscription', async () => {
  currentAuthUser = { _id: 'user-1', email: 'alice@example.com', stripeSubscriptionId: 'sub_1' };
  state.nextSubscription = { id: 'sub_1', current_period_end: 1893456000 };

  await withServer(async (base) => {
    const res = await fetch(`${base}/payment/cancel`, { method: 'POST' });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(state.subscriptionUpdateArgs.id, 'sub_1');
    assert.equal(state.subscriptionUpdateArgs.cancel_at_period_end, true);
    assert.ok(json.message);
  });
});

test('cancel: 400 when the user has no subscription', async () => {
  currentAuthUser = { _id: 'user-1', email: 'alice@example.com', stripeSubscriptionId: null };

  await withServer(async (base) => {
    const res = await fetch(`${base}/payment/cancel`, { method: 'POST' });
    assert.equal(res.status, 400);
  });
});

// ---------------------------------------------------------------------------
// POST /payment/webhook
// ---------------------------------------------------------------------------

test('webhook: checkout.session.completed upgrades the user to premium', async () => {
  state.paymentRow = {
    orderId: 'cs_test_123',
    userId: 'user-1',
    notes: { membershipType: 'gold' },
    save: async function () {
      state.savedPayment = this;
    },
  };
  state.users['user-1'] = {
    _id: 'user-1',
    isPremium: false,
    membershipType: '',
    save: async function () {
      state.users['user-1'] = this;
    },
  };
  state.nextSubscription = {
    id: 'sub_1',
    status: 'active',
    current_period_end: 1893456000,
  };
  state._nextEvent = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        payment_status: 'paid',
        payment_intent: 'pi_1',
        subscription: 'sub_1',
        customer: 'cus_1',
        metadata: { userId: 'user-1', membershipType: 'gold' },
      },
    },
  };

  await withServer(async (base) => {
    const res = await fetch(`${base}/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=1,v1=x' },
      body: JSON.stringify({ any: 'payload' }),
    });

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { received: true });

    // Signature verification must run against the raw body (a Buffer).
    assert.ok(Buffer.isBuffer(state.constructEventArg));

    assert.equal(state.savedPayment.status, 'paid');
    assert.equal(state.savedPayment.paymentId, 'pi_1');
    assert.equal(state.subscriptionRetrieveArg, 'sub_1');
    assert.equal(state.users['user-1'].isPremium, true);
    assert.equal(state.users['user-1'].membershipType, 'gold');
    assert.equal(state.users['user-1'].stripeCustomerId, 'cus_1');
    assert.equal(state.users['user-1'].stripeSubscriptionId, 'sub_1');
    assert.deepEqual(
      state.users['user-1'].premiumExpiresAt,
      new Date(1893456000 * 1000)
    );
  });
});

test('webhook: does not upgrade when payment_status is not paid', async () => {
  state.users['user-1'] = {
    _id: 'user-1', isPremium: false, membershipType: '',
    save: async function () { state.users['user-1'] = this; },
  };
  state._nextEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_x', payment_status: 'unpaid', subscription: 'sub_1', metadata: { userId: 'user-1' } } },
  };

  await withServer(async (base) => {
    const res = await fetch(`${base}/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'x' },
      body: '{}',
    });
    assert.equal(res.status, 200);
    assert.equal(state.users['user-1'].isPremium, false);
  });
});

test('webhook: customer.subscription.updated renews the expiry date', async () => {
  state.users['user-1'] = {
    _id: 'user-1',
    isPremium: true,
    membershipType: 'gold',
    stripeSubscriptionId: 'sub_1',
    save: async function () { state.users['user-1'] = this; },
  };
  state._nextEvent = {
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_1',
        status: 'active',
        current_period_end: 1999999999,
        metadata: { userId: 'user-1', membershipType: 'gold' },
      },
    },
  };

  await withServer(async (base) => {
    const res = await fetch(`${base}/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'x' },
      body: '{}',
    });
    assert.equal(res.status, 200);
    assert.equal(state.users['user-1'].isPremium, true);
    assert.deepEqual(
      state.users['user-1'].premiumExpiresAt,
      new Date(1999999999 * 1000)
    );
  });
});

test('webhook: customer.subscription.deleted downgrades the user', async () => {
  state.users['user-1'] = {
    _id: 'user-1',
    isPremium: true,
    membershipType: 'gold',
    stripeSubscriptionId: 'sub_1',
    premiumExpiresAt: new Date(),
    save: async function () { state.users['user-1'] = this; },
  };
  state._nextEvent = {
    type: 'customer.subscription.deleted',
    data: {
      object: { id: 'sub_1', metadata: { userId: 'user-1' } },
    },
  };

  await withServer(async (base) => {
    const res = await fetch(`${base}/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'x' },
      body: '{}',
    });
    assert.equal(res.status, 200);
    assert.equal(state.users['user-1'].isPremium, false);
    assert.equal(state.users['user-1'].membershipType, '');
    assert.equal(state.users['user-1'].stripeSubscriptionId, null);
    assert.equal(state.users['user-1'].premiumExpiresAt, null);
  });
});

test('webhook: 400 on an invalid signature', async () => {
  await withServer(async (base) => {
    // Make constructEvent throw like the real SDK does on a bad signature.
    const original = fakeStripe.webhooks.constructEvent;
    fakeStripe.webhooks.constructEvent = () => {
      throw new Error('No signatures found matching the expected signature');
    };
    try {
      const res = await fetch(`${base}/payment/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'stripe-signature': 'bad' },
        body: '{}',
      });
      assert.equal(res.status, 400);
      assert.match(await res.text(), /Webhook Error/);
    } finally {
      fakeStripe.webhooks.constructEvent = original;
    }
  });
});

test('webhook: ignores unrelated event types but still returns 200', async () => {
  state._nextEvent = { type: 'payment_intent.created', data: { object: {} } };
  await withServer(async (base) => {
    const res = await fetch(`${base}/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'x' },
      body: '{}',
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { received: true });
  });
});
