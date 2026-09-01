// Vercel serverless entrypoint. The whole app (Express + Socket.IO) lives in
// ../index.js and exports the HTTP server; Vercel invokes that per request and
// upgrades WebSocket connections on it.
module.exports = require('../index.js');
