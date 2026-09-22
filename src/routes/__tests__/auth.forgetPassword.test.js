const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

// ---------------------------------------------------------------------------
// Integration tests for the OTP-gated password reset flow. The REAL router is
// mounted; the User model and email transport are stubbed via the require
// cache so the suite runs offline. bcrypt/crypto are the real modules, so
// this also exercises the actual hashing/expiry logic.
// ---------------------------------------------------------------------------

const state = {
  users: {}, // email -> user doc
  lastEmailBody: null,
  lastEmailTo: null,
  sendEmailResult: { id: 'email-1' },
};

function stub(relFromRoute, exports) {
  const id = require.resolve(path.join(__dirname, '..', relFromRoute));
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

// A minimal stand-in for a Mongoose Query: chainable `.select()`, awaitable.
function makeQuery(result) {
  return {
    select() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
}

stub('../models/User.js', {
  findOne: ({ email }) => makeQuery(state.users[email] || null),
});

stub('../helpers/sendEmail.js', {
  run: async (subject, body, options) => {
    state.lastEmailBody = body;
    state.lastEmailTo = options.to;
    return state.sendEmailResult;
  },
});

const authRouter = require('../auth.js');

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/', authRouter);
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

function makeUser(overrides = {}) {
  const user = {
    email: 'alice@example.com',
    password: 'hashed',
    resetOtpHash: null,
    resetOtpExpires: null,
    save: async function () {
      state.users[this.email] = this;
    },
    ...overrides,
  };
  return user;
}

function extractOtp(body) {
  const match = /code is (\d{6})/.exec(body);
  return match && match[1];
}

test.beforeEach(() => {
  state.users = { 'alice@example.com': makeUser() };
  state.lastEmailBody = null;
  state.lastEmailTo = null;
  state.sendEmailResult = { id: 'email-1' };
});

// ---------------------------------------------------------------------------
// POST /auth/forgetPassword/send-otp
// ---------------------------------------------------------------------------

test('send-otp: 400 for an unknown email', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/auth/forgetPassword/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: 'nobody@example.com' }),
    });
    assert.equal(res.status, 400);
  });
});

test('send-otp: emails a 6-digit code and stores its hash + expiry', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/auth/forgetPassword/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: 'alice@example.com' }),
    });
    assert.equal(res.status, 200);
    assert.equal(state.lastEmailTo, 'alice@example.com');

    const otp = extractOtp(state.lastEmailBody);
    assert.ok(otp, 'email body should contain a 6-digit code');

    const user = state.users['alice@example.com'];
    assert.ok(user.resetOtpHash);
    assert.ok(user.resetOtpExpires instanceof Date);
    assert.ok(user.resetOtpExpires.getTime() > Date.now());
  });
});

test('send-otp: 429 when requested again inside the cooldown window', async () => {
  await withServer(async (base) => {
    await fetch(`${base}/auth/forgetPassword/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: 'alice@example.com' }),
    });
    const res = await fetch(`${base}/auth/forgetPassword/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: 'alice@example.com' }),
    });
    assert.equal(res.status, 429);
  });
});

test('send-otp: 502 when the email fails to send', async () => {
  state.sendEmailResult = { error: 'Email sending failed', details: 'boom' };
  await withServer(async (base) => {
    const res = await fetch(`${base}/auth/forgetPassword/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: 'alice@example.com' }),
    });
    assert.equal(res.status, 502);
  });
});

test('send-otp: 503 when no email transport is configured', async () => {
  state.sendEmailResult = { message: 'Email sending disabled - no transport configured' };
  await withServer(async (base) => {
    const res = await fetch(`${base}/auth/forgetPassword/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: 'alice@example.com' }),
    });
    assert.equal(res.status, 503);
  });
});

// ---------------------------------------------------------------------------
// PATCH /forgetPassword
// ---------------------------------------------------------------------------

async function requestOtp(base) {
  await fetch(`${base}/auth/forgetPassword/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailId: 'alice@example.com' }),
  });
  return extractOtp(state.lastEmailBody);
}

test('forgetPassword: 400 when no otp is supplied', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/forgetPassword`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: 'alice@example.com', password: 'Str0ng!Pass' }),
    });
    assert.equal(res.status, 400);
  });
});

test('forgetPassword: 400 when no otp was ever requested', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/forgetPassword`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: 'alice@example.com', otp: '123456', password: 'Str0ng!Pass' }),
    });
    assert.equal(res.status, 400);
    assert.match((await res.json()).message, /expired or not requested/);
  });
});

test('forgetPassword: 400 on a wrong otp', async () => {
  await withServer(async (base) => {
    const realOtp = await requestOtp(base);
    const wrongOtp = realOtp === '111111' ? '222222' : '111111';

    const res = await fetch(`${base}/forgetPassword`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: 'alice@example.com', otp: wrongOtp, password: 'Str0ng!Pass' }),
    });
    assert.equal(res.status, 400);
    assert.match((await res.json()).message, /Invalid reset code/);
  });
});

test('forgetPassword: 400 when the new password is not strong', async () => {
  await withServer(async (base) => {
    const otp = await requestOtp(base);
    const res = await fetch(`${base}/forgetPassword`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: 'alice@example.com', otp, password: 'weak' }),
    });
    assert.equal(res.status, 400);
    assert.match((await res.json()).message, /not Strong/);
  });
});

test('forgetPassword: updates the password and clears the otp on success', async () => {
  await withServer(async (base) => {
    const otp = await requestOtp(base);
    const res = await fetch(`${base}/forgetPassword`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: 'alice@example.com', otp, password: 'Str0ng!Pass1' }),
    });
    assert.equal(res.status, 200);

    const user = state.users['alice@example.com'];
    assert.notEqual(user.password, 'hashed');
    assert.equal(user.resetOtpHash, null);
    assert.equal(user.resetOtpExpires, null);
  });
});

test('forgetPassword: an otp cannot be reused', async () => {
  await withServer(async (base) => {
    const otp = await requestOtp(base);
    await fetch(`${base}/forgetPassword`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: 'alice@example.com', otp, password: 'Str0ng!Pass1' }),
    });

    const res = await fetch(`${base}/forgetPassword`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: 'alice@example.com', otp, password: 'Str0ng!Pass2' }),
    });
    assert.equal(res.status, 400);
  });
});
