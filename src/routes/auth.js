const express = require('express');
const authRouter = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const { validateData } = require('../helpers/Validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
var validator = require('validator');
const sendEmail = require('../helpers/sendEmail');

const OTP_TTL_MS = 10 * 60 * 1000; // OTP is valid for 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // at most one OTP per minute

//=================================Sign Up user

authRouter.post('/auth/signup', async (req, res) => {
  try {
    const plainPassword = req.body.password;
    try {
      await validateData(req.body);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const encryptedPassword = await bcrypt.hash(plainPassword, 10);
    const requestedUserData = {
      firstName: req?.body?.firstName,
      lastName: req?.body?.lastName,
      email: req?.body?.email,
      password: encryptedPassword,
      age: req?.body?.age,
      about: req?.body?.about,
      skills: req?.body?.skills,
      photoUrl: req?.body?.photoUrl,
    };
    const UserInstance = new User(requestedUserData);
    let resultedUser = await UserInstance.save();
    const token = await jwt.sign(
      {
        email: req?.body?.email,
      },
      process.env.JWT_TOKEN
    );

    res.cookie('token', token, {
      expire: new Date(Date.now() + 86400000),
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    }); //BITF21M519
    res.json(resultedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//=================================Login User
authRouter.post('/auth/login', async (req, res) => {
  const { password, email } = req.body;
  try {
    if (!password || !email) {
      throw new Error('Email or password is incorrect');
    }
    const userData = await User.findOne({
      email,
    });
    if (!userData) {
      return res.status(400).json({ message: 'Invalid Email or password!' });
    }

    const varifiedPassword = await bcrypt.compare(password, userData.password);
    if (!varifiedPassword)
      return res.status(400).json({ message: 'Invalid Email or password!' });
    const token = await jwt.sign(
      {
        email,
      },
      process.env.JWT_TOKEN
    );
    res.cookie('token', token, {
      expire: new Date(Date.now() + 86400000),
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    }); //BITF21M519
    res.json(userData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

authRouter.post('/auth/logout', async (req, res) => {

  res.cookie('token', null, {
    expires: new Date(0), // Set expiration to Unix epoch time (Jan 1, 1970)
    path: '/', // Ensure the cookie is deleted for the entire domain
    httpOnly: true,
  });
  res.send('Logout Successfully');
});

// Step 1: request a one-time code sent to the account's email. Required
// before /forgetPassword will accept a new password - otherwise anyone who
// knows a user's email could reset their password with no verification.
authRouter.post('/auth/forgetPassword/send-otp', async (req, res) => {
  try {
    const emailId = req.body.emailId;
    if (!emailId) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const userData = await User.findOne({ email: emailId }).select(
      '+resetOtpExpires'
    );
    if (!userData) {
      return res.status(400).json({
        message: 'Account with given email not exist!!',
      });
    }

    // Cooldown: a previous OTP is still valid for more than (TTL - cooldown),
    // i.e. it was issued less than `OTP_RESEND_COOLDOWN_MS` ago.
    if (
      userData.resetOtpExpires &&
      userData.resetOtpExpires.getTime() - Date.now() >
        OTP_TTL_MS - OTP_RESEND_COOLDOWN_MS
    ) {
      return res.status(429).json({
        message: 'Please wait a bit before requesting another code.',
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    userData.resetOtpHash = await bcrypt.hash(otp, 10);
    userData.resetOtpExpires = new Date(Date.now() + OTP_TTL_MS);
    await userData.save();

    const result = await sendEmail.run(
      'Your Tinder password reset code',
      `Your password reset code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      { to: emailId }
    );

    if (result.error) {
      return res.status(502).json({
        message: 'Failed to send the reset code. Please try again shortly.',
      });
    }
    if (result.message) {
      // Email transport not configured server-side.
      return res.status(503).json({ message: 'Email service is not configured.' });
    }

    res.json({ message: 'A reset code has been sent to your email.' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});

// Step 2: verify the code and set the new password.
authRouter.patch('/forgetPassword', async (req, res) => {

  try {
    const emailId = req.body.emailId;
    const otp = req.body.otp;

    if (!otp) {
      return res.status(400).json({ message: 'Reset code is required.' });
    }

    const userData = await User.findOne({ email: emailId }).select(
      '+resetOtpHash +resetOtpExpires'
    );
    if (!userData) {
      return res.status(400).json({
        message: 'Account with given email not exist!!',
      });
    }

    if (
      !userData.resetOtpHash ||
      !userData.resetOtpExpires ||
      userData.resetOtpExpires.getTime() < Date.now()
    ) {
      return res.status(400).json({
        message: 'Reset code expired or not requested. Please request a new one.',
      });
    }

    const otpMatches = await bcrypt.compare(String(otp), userData.resetOtpHash);
    if (!otpMatches) {
      return res.status(400).json({ message: 'Invalid reset code.' });
    }

    const plainPassword = req.body.password;
    if (!validator.isStrongPassword(plainPassword)) {
      return res.status(400).json({
        message: `Password is not Strong!!Must contain atleast one Capital letter,1 small letter , 1 number and 1 unique character`,
      });
    }

    const encryptedPassword = await bcrypt.hash(plainPassword, 10);

    userData.password = encryptedPassword;
    userData.resetOtpHash = null;
    userData.resetOtpExpires = null;

    await userData.save();
    res.send('Password Updated Successfully!!');
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = authRouter;
