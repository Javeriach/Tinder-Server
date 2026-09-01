const { default: mongoose } = require('mongoose');
const dns = require('node:dns');

// Some local ISP resolvers refuse MongoDB SRV (mongodb+srv://) lookups, so in
// local development we point Node at public DNS. This must NOT run on Vercel -
// the Lambda sandbox resolves Atlas fine on its own, and forcing external
// resolvers there breaks the SRV lookup ("Could not connect to any servers").
if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch {
    /* setServers unavailable - ignore */
  }
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
};

module.exports = connectDB;
