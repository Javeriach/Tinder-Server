const test = require('node:test');
const assert = require('node:assert/strict');

const resendClient = require('../resendClient.js');
const gmailTransport = require('../gmailTransport.js');
const { run, buildEmailPayload, buildGmailPayload } = require('../sendEmail.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Snapshot + restore the env vars a test touches. */
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

/** Replace getResendClient with a fake for the duration of the test. */
function stubClient(t, fake) {
  t.mock.method(resendClient, 'getResendClient', () => fake);
}

/** Replace getGmailTransport with a fake for the duration of the test. */
function stubGmail(t, fake) {
  t.mock.method(gmailTransport, 'getGmailTransport', () => fake);
}

// Keep test output clean, and make sure a real .env's GMAIL_* vars can't make
// run() pick the Gmail transport in the Resend-focused tests below.
test.beforeEach((t) => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  t.mock.method(gmailTransport, 'getGmailTransport', () => null);
});

// ---------------------------------------------------------------------------
// buildEmailPayload  (pure function)
// ---------------------------------------------------------------------------

test('buildEmailPayload: builds the shape Resend expects', () => {
  withEnv({ EMAIL_FROM: undefined, EMAIL_TO: undefined }, () => {
    const payload = buildEmailPayload('My Subject', 'My Body');

    assert.equal(payload.from, 'onboarding@resend.dev');
    assert.deepEqual(payload.to, ['javeriakanwal383@gmail.com']);
    assert.equal(payload.subject, 'My Subject');
    assert.match(payload.html, /<!DOCTYPE html>/i); // branded template
    assert.match(payload.html, /My Body/);
    assert.equal(payload.text, 'My Body'); // plain-text part stays unwrapped
  });
});

test('buildEmailPayload: honours EMAIL_FROM / EMAIL_TO env vars', () => {
  withEnv(
    { EMAIL_FROM: 'alerts@mydomain.com', EMAIL_TO: 'admin@mydomain.com' },
    () => {
      const payload = buildEmailPayload('S', 'B');
      assert.equal(payload.from, 'alerts@mydomain.com');
      assert.deepEqual(payload.to, ['admin@mydomain.com']);
    }
  );
});

test('buildEmailPayload: explicit overrides beat env vars', () => {
  withEnv({ EMAIL_FROM: 'env@x.com', EMAIL_TO: 'env@y.com' }, () => {
    const payload = buildEmailPayload('S', 'B', {
      from: 'over@x.com',
      to: 'over@y.com',
    });
    assert.equal(payload.from, 'over@x.com');
    assert.deepEqual(payload.to, ['over@y.com']);
  });
});

// ---------------------------------------------------------------------------
// buildGmailPayload  (pure function)
// ---------------------------------------------------------------------------

test('buildGmailPayload: from is the Gmail user with a display name, to is a string', () => {
  withEnv(
    { GMAIL_USER: 'me@gmail.com', GMAIL_FROM_NAME: undefined, EMAIL_TO: 'admin@x.com' },
    () => {
      const payload = buildGmailPayload('Subj', 'Body');
      assert.equal(payload.from, '"Tinder" <me@gmail.com>');
      assert.equal(payload.to, 'admin@x.com'); // string, not array (Nodemailer)
      assert.equal(payload.subject, 'Subj');
      assert.match(payload.html, /<!DOCTYPE html>/i);
      assert.match(payload.html, /Body/);
      assert.equal(payload.text, 'Body');
    }
  );
});

test('buildGmailPayload: honours GMAIL_FROM_NAME and a custom recipient/html', () => {
  withEnv({ GMAIL_USER: 'me@gmail.com', GMAIL_FROM_NAME: 'DevTinder' }, () => {
    const payload = buildGmailPayload('S', 'B', {
      to: 'bob@example.com',
      html: '<p>hi</p>',
    });
    assert.equal(payload.from, '"DevTinder" <me@gmail.com>');
    assert.equal(payload.to, 'bob@example.com');
    assert.equal(payload.html, '<p>hi</p>');
  });
});

// ---------------------------------------------------------------------------
// run()  — Gmail transport is preferred when configured
// ---------------------------------------------------------------------------

test('run: uses the Gmail transport when one is available', async (t) => {
  const sendMail = t.mock.fn(async () => ({ messageId: '<abc@gmail.com>' }));
  stubGmail(t, { sendMail });
  // Resend must NOT be touched.
  stubClient(t, { emails: { send: t.mock.fn() } });

  const result = await withEnv(
    { GMAIL_USER: 'me@gmail.com', EMAIL_TO: 'admin@x.com' },
    () => run('Hi', 'There', { to: 'bob@example.com' })
  );

  assert.deepEqual(result, { id: '<abc@gmail.com>' });
  assert.equal(sendMail.mock.callCount(), 1);
  assert.equal(sendMail.mock.calls[0].arguments[0].to, 'bob@example.com');
});

test('run: maps a Gmail send failure to { error, details }', async (t) => {
  const sendMail = t.mock.fn(async () => {
    throw new Error('Invalid login: 535-5.7.8');
  });
  stubGmail(t, { sendMail });

  const result = await run('S', 'B');

  assert.equal(result.error, 'Email sending failed');
  assert.match(result.details, /Invalid login/);
});

// ---------------------------------------------------------------------------
// run()  — disabled path
// ---------------------------------------------------------------------------

test('run: returns a disabled message when no transport is configured', async (t) => {
  stubGmail(t, null);
  stubClient(t, null);

  const result = await run('Subject', 'Body');

  assert.equal(result.error, undefined);
  assert.match(result.message, /disabled/i);
});

// ---------------------------------------------------------------------------
// run()  — success path
// ---------------------------------------------------------------------------

test('run: returns Resend data and sends the built payload on success', async (t) => {
  const send = t.mock.fn(async () => ({ data: { id: 'email_123' }, error: null }));
  stubClient(t, { emails: { send } });

  const result = await withEnv(
    { EMAIL_FROM: 'onboarding@resend.dev', EMAIL_TO: 'to@test.com' },
    () => run('Hello', 'World')
  );

  assert.deepEqual(result, { id: 'email_123' });
  assert.equal(send.mock.callCount(), 1);

  const sentPayload = send.mock.calls[0].arguments[0];
  assert.equal(sentPayload.from, 'onboarding@resend.dev');
  assert.deepEqual(sentPayload.to, ['to@test.com']);
  assert.equal(sentPayload.subject, 'Hello');
  assert.match(sentPayload.html, /World/);
  assert.equal(sentPayload.text, 'World');
});

test('run: tolerates a missing body (the cron job calls run(subject) only)', async (t) => {
  const send = t.mock.fn(async () => ({ data: { id: 'e1' }, error: null }));
  stubClient(t, { emails: { send } });

  const result = await run('Only a subject');

  assert.deepEqual(result, { id: 'e1' });
  assert.equal(typeof send.mock.calls[0].arguments[0].html, 'string');
  assert.ok(send.mock.calls[0].arguments[0].html.length > 0);
});

// ---------------------------------------------------------------------------
// run()  — failure paths
// ---------------------------------------------------------------------------

test('run: maps a Resend API error to { error, details }', async (t) => {
  const send = t.mock.fn(async () => ({
    data: null,
    error: { name: 'validation_error', message: 'API key is invalid' },
  }));
  stubClient(t, { emails: { send } });

  const result = await run('S', 'B');

  assert.equal(result.error, 'Email sending failed');
  assert.equal(result.details, 'API key is invalid');
});

test('run: catches a thrown/network error and returns { error, details }', async (t) => {
  const send = t.mock.fn(async () => {
    throw new Error('socket hang up');
  });
  stubClient(t, { emails: { send } });

  const result = await run('S', 'B');

  assert.equal(result.error, 'Email sending failed');
  assert.equal(result.details, 'socket hang up');
});

// ---------------------------------------------------------------------------
// resendClient
// ---------------------------------------------------------------------------

test('getResendClient: null without RESEND_API_KEY, cached instance with it', () => {
  resendClient.resetResendClient();

  withEnv({ RESEND_API_KEY: undefined }, () => {
    assert.equal(resendClient.getResendClient(), null);
  });

  withEnv({ RESEND_API_KEY: 're_test_key' }, () => {
    const a = resendClient.getResendClient();
    const b = resendClient.getResendClient();
    assert.ok(a, 'client should be created');
    assert.equal(typeof a.emails.send, 'function');
    assert.equal(a, b, 'client should be cached');
  });

  resendClient.resetResendClient();
});
