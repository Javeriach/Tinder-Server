const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const express = require('express');

// ---------------------------------------------------------------------------
// This is an integration test for POST /request/send/:status/:toUserId.
// It mounts the REAL router but stubs its heavy dependencies (auth, Mongoose
// models, the email transport) via the require cache, so it runs offline.
// Goal: prove the route actually calls the Resend email helper with the
// subject/body the product expects.
// ---------------------------------------------------------------------------

const emailCalls = [];

function stub(relFromRoute, exports) {
  // Resolve the module id exactly as src/routes/connectionRequest.js would.
  const id = require.resolve(
    path.join(__dirname, '..', relFromRoute)
  );
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

// --- auth middleware: inject a fake logged-in user, skip JWT/DB ---
stub('../MiddleWares/auth.js', (req, _res, next) => {
  req.body.userData = { _id: 'sender-1', firstName: 'Alice', lastName: 'A' };
  next();
});

// --- ConnectionRequest model: no existing request, save() succeeds ---
function ConnectionRequest(doc) {
  Object.assign(this, doc);
}
ConnectionRequest.findOne = async () => null;
ConnectionRequest.prototype.save = async function save() {
  return { ...this, _id: 'req-1' };
};
stub('../models/connectionrequest.js', ConnectionRequest);

// --- User model: the receiver exists ---
stub('../models/User.js', {
  findOne: async () => ({
    _id: 'receiver-1',
    firstName: 'Bob',
    lastName: 'B',
    email: 'bob@example.com',
  }),
});

// --- email helper: record calls instead of hitting Resend ---
stub('../helpers/sendEmail.js', {
  run: async (subject, body, options = {}) => {
    emailCalls.push({ subject, body, options });
    return { id: 'email-stub-1' };
  },
});

// Require the real router AFTER the stubs are in place.
const requestRouter = require('../connectionRequest.js');

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/', requestRouter);
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test('POST /request/send/interested/:id emails the receiver via the helper', async () => {
  emailCalls.length = 0;
  const server = await startServer();
  const { port } = server.address();

  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/request/send/interested/receiver-1`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
    );
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.match(json.message, /interested in Bob B/);

    // The email must be sent asynchronously (fire-and-forget). Give the
    // route's dangling promise a tick to settle.
    await new Promise((r) => setImmediate(r));

    // Exactly one email, addressed to the receiver, worded from their POV.
    assert.equal(emailCalls.length, 1);
    assert.match(emailCalls[0].subject, /connection request/i);
    assert.equal(emailCalls[0].options.to, 'bob@example.com');
    assert.match(emailCalls[0].body, /Alice A is interested in connecting with you/);
  } finally {
    server.close();
  }
});

test('POST /request/send/ignored/:id does NOT email anyone', async () => {
  emailCalls.length = 0;
  const server = await startServer();
  const { port } = server.address();

  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/request/send/ignored/receiver-1`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
    );
    assert.equal(res.status, 200);

    await new Promise((r) => setImmediate(r));
    assert.equal(emailCalls.length, 0);
  } finally {
    server.close();
  }
});
