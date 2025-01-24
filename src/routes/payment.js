const express = require('express');
const razorpayInstance = require('../helpers/razorpayInstance');
const paymentRouter = express.Router();
const User = require('../models/User');
const authentication = require('../MiddleWares/auth');
const membership_Plans_Price = require('../helpers/constants');
const Payment = require('../models/payment.js');

const {
  validateWebhookSignature,
} = require('razorpay/dist/utils/razorpay-utils.js');

paymentRouter.post('/payment/create', authentication, async (req, res) => {
  const { firstName, lastName, email } = req.body.userData;
  const membershipType = req?.body?.membershipType;

  try {
    if (!membershipType) throw new Error('Membership type not defined.');
    if (!req?.body?.benefits.length)
      throw new Error('Benefits are not defined.');
    //OPTIONS WHICH WE WILL SHOW IN THE RAZORPAY RECEIPT ID
    var options = {
      amount: membership_Plans_Price[membershipType] * 100, // Amount is in currency subunits. Default currency is INR. Hence, 50000 refers to 50000 paise
      currency: 'PKR',
      receipt: 'order_rcptid_11',
      notes: {
        //METADATA WHICH YOU WANT OT SHOW IN RECEIPT
        firstName,
        lastName,
        email,
        membershipType: membershipType,
        benefits: req?.body?.benefits,
      },
    };

    //WE HAVE CREATED THE ORDER FOR THE USER TILL NOW

    const orderDetails = await razorpayInstance.orders.create(options);

    //ONWORD DATA OF ORDER WHICH WE WANT TO SAVE IN THE DATABASE

    const payment = new Payment({
      orderId: orderDetails.id,
      amount: orderDetails.amount,
      currency: orderDetails.currency,
      receiptId: orderDetails.receipt,
      status: orderDetails.status,
      notes: orderDetails.notes,
      userId: req.body.userData._id,
    });

    const savedOrderDetails = await payment.save();

    res.json({
      ...savedOrderDetails.toJSON(),
      keyId: process.env.RazorPay_Key_ID,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

paymentRouter.post('/payment/webhook', async (req, res) => {
  try {
    const webhookSignature = req.get('X-Razorpay-Signature');
    //VALIDATE WEBHOOK EITHER IT IS FROM AUTHENTIC SOURCE OR NOT
    const isValidWebhook = validateWebhookSignature(
      JSON.stringify(req.body),
      webhookSignature,
      process.env.Razorpay_Webhook
    );

    if (!isValidWebhook) {
      //CHECK VALIDITY
      res.status(400).json({ msg: error.message });
    }
    console.log(isValidWebhook);
    const paymentDetails = req.body.payload.payment.entity; // FETCH PAYPMENT DETAILS FROM REQUEST BODY

    //WE HAVE TO UPDATE THE STATUS IN OUR DATABASE
    console.log(paymentDetails);
    const payment = await Payment.findOne({ orderId: paymentDetails.order_id });
    payment.status = paymentDetails.status;
    await payment.save();
    console.log('Payment Updated');
    //USER DETAILS UPDATION
    const user = await User.findOne({ _id: payment.userId });
    user.isPremium = true;
    user.membershipType = payment.notes.membershipType;
    await user.save();
    console.log('User saved');
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

//API TO VERIFY EITHER THE CURRENT USER IS A PREMIUM USER OR NOT
paymentRouter.get('/premium/verify', authentication, async (req, res) => {
  try {
    const user = req.body.userData.toJSON();
    res.json({ ...user });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

module.exports = paymentRouter;
