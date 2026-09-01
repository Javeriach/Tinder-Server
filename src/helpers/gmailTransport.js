const nodemailer = require('nodemailer');

// Lazily-created singleton Nodemailer transport for Gmail SMTP.
//
// Gmail SMTP lets you send to ANY recipient for free (~500/day) without owning
// a domain - unlike Resend's shared sender, which only delivers to the account
// owner. It needs a Google account with 2-Step Verification enabled and an
// "App Password" (https://myaccount.google.com/apppasswords).
//
// Built on first use (not at import time) so tests can set/unset the env vars
// per case and serverless cold starts don't pay the cost until an email is sent.
let transport;

/**
 * Returns a shared Gmail transport, or `null` when GMAIL_USER /
 * GMAIL_APP_PASSWORD are not both set (callers then fall back to Resend).
 */
const getGmailTransport = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  if (!transport) {
    transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return transport;
};

/** Test helper: drop the cached transport so the next call rebuilds it. */
const resetGmailTransport = () => {
  transport = undefined;
};

module.exports = { getGmailTransport, resetGmailTransport };
