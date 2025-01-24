const moongoose = require('mongoose');

const payment_Schema = new moongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    receiptId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
    },
    notes: {
      firstName: {
        type: String,
        required: true,
      },
      lastName: {
        type: String,
        required: true,
      },
      membershipType: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
      },
      benefits: {
        type: Array,
        required: true,
      },
    },
    userId: {
      type: moongoose.Types.ObjectId,
      ref: 'User',
    },
    paymentId: {
      type: String, //NOT MAKE IT REQUIRE BECAUSE IT IS POSSIBLE THE USER NOT MAKE PAYMENT
    },
  },
  { timestamps: true }
);

const Payment = new moongoose.model('Payment', payment_Schema);
module.exports = Payment;
