require('dotenv').config();
const express = require('express');
const app = express();
const connectDB = require('./src/config/database');
const authRouter = require('./src/routes/auth');
const profileRouter = require('./src/routes/profile');
const cookieParser = require('cookie-parser');
const requestRouter = require('./src/routes/connectionRequest');
const userRouter = require('./src/routes/usersConnection');
const paymentRouter = require('./src/routes/payment.js');
const initializeSocket = require('./src/helpers/socket.js');
const chatRouter = require('./src/routes/chat');

const http = require('http');
const cors = require('cors');
const { allowedOrigins } = require('./src/config/cors');

// node-cron needs a long-lived process; it does nothing on serverless.
if (!process.env.VERCEL) {
  require('./src/helpers/cronjobs');
}

// Warn (don't crash) if required config is missing - on serverless a crash
// gives an opaque "exit status: 1"; a running app can return a real error.
const requiredEnvVars = ['MONGODB_CONNECTION_STRING', 'JWT_TOKEN'];
const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
}

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  })
);
// Stripe webhooks need the untouched raw body for signature verification,
// so this must be registered before the JSON body parser.
app.use('/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(cookieParser());

// Ensure MongoDB is connected before handling any route. CORS preflight
// (OPTIONS) is answered by the cors middleware above and never reaches here,
// so a DB outage still returns proper CORS headers.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({
      message: 'Database unavailable',
      error: err.message,
    });
  }
});

//EXPRESS ROUTERS
app.use('/', authRouter); // Routes for authentication
app.use('/', profileRouter); // Routes for profile management
app.use('/', requestRouter); // Routes for connection resquests
app.use('/', userRouter); // Routes for user connections
app.use('/', paymentRouter); // Routes for payment
app.use('/', chatRouter); // Routes for Realtime chat

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

app.all('*', (req, res) => {
  res.status(404).json({ message: 'Path not found!!' });
});

const httpServer = http.createServer(app);
initializeSocket(httpServer).catch((err) =>
  console.error('Socket.IO init failed:', err.message)
);

// Only run a long-lived listener outside Vercel (local dev / traditional hosts).
// On Vercel the exported `app` is invoked per request instead.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 7777;

  connectDB()
    .then(() => {
      httpServer.listen(PORT, () => {
        console.log(`Server started listening on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Database connection failed:', err.message);
      process.exit(1);
    });

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}

// Export the HTTP server (not the bare Express app) so Vercel routes both HTTP
// requests and WebSocket upgrades to it - Socket.IO is attached to this server.
module.exports = httpServer;
