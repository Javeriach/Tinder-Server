const Razorpay = require('razorpay');

var razorpayInstance = new Razorpay({
  key_id: process.env.RazorPay_Key_ID,
  key_secret: process.env.Razor_Pay_Key_Secret,
});
module.exports = razorpayInstance;
