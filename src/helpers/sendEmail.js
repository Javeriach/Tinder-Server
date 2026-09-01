const resendClient = require('./resendClient.js');
const gmailTransport = require('./gmailTransport.js');
const { renderEmail } = require('./emailTemplate.js');

// Default HTML body: wrap plain text in the branded template. Callers that need
// full control pass their own `options.html`.
const defaultHtml = (subject, body) =>
  renderEmail({ heading: subject, body: String(body) });

// Default sender for Resend. Must be on a domain you have verified in the Resend
// dashboard. `onboarding@resend.dev` is Resend's shared test sender and works
// without a verified domain (it can only deliver to the email address that owns
// the Resend account).
const getFromAddress = () => process.env.EMAIL_FROM || 'onboarding@resend.dev';

// Default recipient for admin-alert emails. Override with EMAIL_TO.
const getToAddress = () => process.env.EMAIL_TO || 'javeriakanwal383@gmail.com';

// Gmail rewrites the From header to the authenticated account, so the sender is
// always GMAIL_USER. GMAIL_FROM_NAME just sets the display name.
const getGmailFrom = () => {
  const user = process.env.GMAIL_USER;
  const name = process.env.GMAIL_FROM_NAME || 'Tinder';
  return name ? `"${name}" <${user}>` : user;
};

/**
 * Build the payload Resend's `emails.send` expects.
 * Kept as a pure, exported function so it can be unit-tested in isolation.
 */
const buildEmailPayload = (subject, body, overrides = {}) => ({
  from: overrides.from || getFromAddress(),
  to: [overrides.to || getToAddress()],
  subject,
  html: overrides.html || defaultHtml(subject, body),
  text: String(body),
});

/**
 * Build the payload Nodemailer's `sendMail` expects (Gmail SMTP).
 * Also pure + exported for unit testing.
 */
const buildGmailPayload = (subject, body, overrides = {}) => ({
  from: overrides.from || getGmailFrom(),
  to: overrides.to || getToAddress(),
  subject,
  html: overrides.html || defaultHtml(subject, body),
  text: String(body),
});

/**
 * Send an email. Call as run(subject, body, options).
 *
 * Transport is picked automatically:
 *   1. Gmail SMTP  - when GMAIL_USER + GMAIL_APP_PASSWORD are set (delivers to
 *      any recipient, free, no domain needed)
 *   2. Resend      - when RESEND_API_KEY is set
 *   3. disabled    - neither configured
 *
 * options (all optional):
 *   - to    : recipient address (defaults to EMAIL_TO / admin address)
 *   - from  : sender address
 *   - html  : custom HTML body (defaults to `<h1>${body}</h1>`)
 *
 * Returns:
 *   - not configured -> { message: '...disabled...' }   (no `.error`)
 *   - send failed    -> { error: 'Email sending failed', details }
 *   - send ok        -> { id } (Resend data object, or { id: messageId } for Gmail)
 */
const run = async (subject, body, options = {}) => {
  const gmail = gmailTransport.getGmailTransport();

  if (gmail) {
    const payload = buildGmailPayload(subject, body, options);
    try {
      const info = await gmail.sendMail(payload);
      return { id: info.messageId };
    } catch (caught) {
      console.error('Email sending failed (gmail):', caught.message);
      return { error: 'Email sending failed', details: caught.message };
    }
  }

  const client = resendClient.getResendClient();

  if (!client) {
    console.warn('No email transport configured (GMAIL_* or RESEND_API_KEY). Email sending disabled.');
    return { message: 'Email sending disabled - no transport configured' };
  }

  const payload = buildEmailPayload(subject, body, options);

  try {
    // Resend reports API-level problems via the `error` field, not by throwing.
    const { data, error } = await client.emails.send(payload);

    if (error) {
      console.error('Email sending failed:', error.message || error);
      return { error: 'Email sending failed', details: error.message || String(error) };
    }

    return data;
  } catch (caught) {
    // Network / unexpected errors.
    console.error('Email sending failed:', caught.message);
    return { error: 'Email sending failed', details: caught.message };
  }
};

module.exports = { run, buildEmailPayload, buildGmailPayload };
