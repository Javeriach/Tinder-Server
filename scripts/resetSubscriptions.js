/**
 * Lists every user's premium/subscription state and (optionally) clears it so
 * nobody is left "premium" from the old Razorpay / one-time-Stripe-charge era,
 * which never created a real Stripe subscription to manage.
 *
 *   node scripts/resetSubscriptions.js            -> list users only (dry run)
 *   node scripts/resetSubscriptions.js --reset    -> list users + clear premium state
 *
 * Clears: isPremium, membershipType, premiumExpiresAt, stripeCustomerId,
 * stripeSubscriptionId. Does not touch the Payment collection (order history).
 */
require('dotenv').config();
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // same workaround as src/config/database.js
const mongoose = require('mongoose');
const User = require('../src/models/User');

const doReset = process.argv.includes('--reset');

(async () => {
  await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);

  const users = await User.find(
    {},
    'firstName lastName email isPremium membershipType stripeSubscriptionId'
  )
    .sort({ createdAt: 1 })
    .lean();

  console.log(`\n${users.length} user(s) in DB:\n`);
  users.forEach((u, i) => {
    const status = u.isPremium
      ? `PREMIUM (${u.membershipType || 'unknown'})${u.stripeSubscriptionId ? '' : ' - no subscription id'}`
      : 'free';
    console.log(
      `${String(i + 1).padStart(2)}. ${`${u.firstName} ${u.lastName}`.padEnd(28)} ${u.email.padEnd(30)} ${status}`
    );
  });

  const premiumCount = users.filter((u) => u.isPremium).length;
  console.log(`\n${premiumCount} user(s) currently marked premium.`);

  if (!doReset) {
    console.log('(dry run - nothing changed. Re-run with --reset to clear premium state for everyone.)\n');
    await mongoose.disconnect();
    return;
  }

  const res = await User.updateMany(
    {},
    {
      $set: {
        isPremium: false,
        membershipType: '',
        premiumExpiresAt: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      },
    }
  );

  console.log(`\nCleared premium/subscription state for ${res.modifiedCount} user(s).`);
  console.log('Everyone is now on the Free plan. Payment history was left untouched.\n');

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
