/**
 * Lists all users and (optionally) resets every user's password to a known test value.
 *
 *   node scripts/resetAllPasswords.js            -> list users only (dry run)
 *   node scripts/resetAllPasswords.js --reset    -> list users + reset all passwords
 *
 * Password is hashed with bcrypt (10 rounds), same as src/routes/auth.js.
 */
require('dotenv').config();
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // same workaround as src/config/database.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../src/models/User');

const NEW_PASSWORD = 'Test@1234';
const doReset = process.argv.includes('--reset');

(async () => {
  await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);

  const users = await User.find({}, 'firstName lastName email createdAt').sort({ createdAt: 1 }).lean();

  console.log(`\n${users.length} user(s) in DB:\n`);
  users.forEach((u, i) => {
    console.log(
      `${String(i + 1).padStart(2)}. ${`${u.firstName} ${u.lastName}`.padEnd(28)} ${u.email}`
    );
  });

  if (!doReset) {
    console.log('\n(dry run - no passwords changed. Re-run with --reset to apply.)\n');
    await mongoose.disconnect();
    return;
  }

  const hash = await bcrypt.hash(NEW_PASSWORD, 10);
  const res = await User.updateMany({}, { $set: { password: hash } });

  console.log(`\nPassword reset for ${res.modifiedCount} user(s).`);
  console.log(`Every user can now log in with password: ${NEW_PASSWORD}\n`);

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
