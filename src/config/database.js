const { default: mongoose } = require('mongoose');
const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
};
module.exports = connectDB;
