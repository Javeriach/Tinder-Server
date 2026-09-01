// Allowed browser origins for CORS (HTTP API + Socket.IO).
//
// Set CORS_ORIGINS in the environment as a comma-separated list, e.g.
//   CORS_ORIGINS=https://my-frontend.vercel.app,https://www.mysite.com
// Localhost dev origins are always allowed.

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];

const configured = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Back-compat: FRONTEND_URL is already used for Stripe redirects.
if (process.env.FRONTEND_URL) configured.push(process.env.FRONTEND_URL.trim());

const allowedOrigins = [...new Set([...DEV_ORIGINS, ...configured])];

module.exports = { allowedOrigins };
