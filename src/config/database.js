const { default: mongoose } = require('mongoose');
const dns = require('node:dns');

// Some local ISP resolvers refuse MongoDB SRV (mongodb+srv://) lookups, so in
// local development we point Node at public DNS. This must NOT run on Vercel -
// the Lambda sandbox resolves Atlas fine on its own, and forcing external
// resolvers there breaks the SRV lookup.
if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch {
    /* setServers unavailable - ignore */
  }
}

// Cache the connection across invocations. A warm serverless function reuses
// module scope, so we connect once and reuse it instead of reconnecting per
// request (which exhausts Atlas connection limits and adds latency).
let cached = global.__mongooseConn;
if (!cached) cached = global.__mongooseConn = { conn: null, promise: null };

const connectDB = async () => {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    if (!process.env.MONGODB_CONNECTION_STRING) {
      throw new Error('MONGODB_CONNECTION_STRING environment variable is not set');
    }
    cached.promise = mongoose
      .connect(process.env.MONGODB_CONNECTION_STRING, {
        // Fail fast with a clear error instead of hanging until the function
        // times out.
        serverSelectionTimeoutMS: 8000,
      })
      .then((m) => {
        console.log('MongoDB connected successfully');
        return m;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null; // allow the next request to retry
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
  return cached.conn;
};

module.exports = connectDB;
