const { default: mongoose } = require('mongoose');

const connectDB = async () => {

  try {
    const dns = require('node:dns');
    dns.setServers(['8.8.8.8', '1.1.1.1']); // Use Google and Cloudflare DNS

    await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
};

module.exports = connectDB;
