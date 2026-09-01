const { Resend } = require('resend');

// Lazily-created singleton Resend client.
// The client is built on first use (not at import time) so that:
//   - tests can set/unset RESEND_API_KEY per case
//   - serverless cold starts don't pay the cost until an email is actually sent
let client;

/**
 * Returns a shared Resend client, or `null` when RESEND_API_KEY is not set
 * (callers treat `null` as "email sending disabled").
 */
const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
};

/** Test helper: drop the cached client so the next call rebuilds it. */
const resetResendClient = () => {
  client = undefined;
};

module.exports = { getResendClient, resetResendClient };
