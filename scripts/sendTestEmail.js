/**
 * Manual end-to-end check for the email integration.
 *
 * Usage:
 *   node scripts/sendTestEmail.js
 *   node scripts/sendTestEmail.js "Custom subject" "Custom body"
 *   node scripts/sendTestEmail.js "Subject" "Body" someone@example.com
 *
 * Picks the transport the same way the app does: Gmail SMTP when GMAIL_USER +
 * GMAIL_APP_PASSWORD are set, else Resend. This actually sends an email, so run
 * it deliberately.
 */
require('dotenv').config();

const sendEmail = require('../src/helpers/sendEmail.js');

const subject = process.argv[2] || 'Tinder - email integration test';
const body =
  process.argv[3] ||
  'Congrats on sending your first email from the Tinder backend!';
const to = process.argv[4]; // optional explicit recipient

const usingGmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

(async () => {
  console.log('Sending test email...');
  console.log('  transport:', usingGmail ? 'Gmail SMTP' : 'Resend');
  console.log('  to:       ', to || process.env.EMAIL_TO || 'javeriakanwal383@gmail.com (default)');

  const result = await sendEmail.run(subject, body, to ? { to } : {});

  if (result.error) {
    console.error('\n❌ FAILED:', result.error, '-', result.details);
    process.exitCode = 1;
  } else if (result.message) {
    console.warn('\n⚠️  SKIPPED:', result.message);
    process.exitCode = 2;
  } else {
    console.log('\n✅ SENT. message id:', result.id);
    process.exitCode = 0;
  }
})();
