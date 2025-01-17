const express = require('express');
const authRouter = express.Router();
const User = require('../models/User');
const { validateData } = require('../helpers/Validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
var validator = require('validator');

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
    res.cookie('token', token, { expire: new Date(Date.now() + 86400000) }); //BITF21M519
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
    res.cookie('token', token, { expire: new Date(Date.now() + 86400000) }); //BITF21M519
    res.json(userData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

authRouter.post('/auth/logout', async (req, res) => {
  res.cookie('token', null, { expires: new Date(Date.now()) });
  res.send('Logout Successfully');
});

authRouter.patch('/forgetPassword', async (req, res) => {
  try {
    const emailId = req.body.emailId;
    const userData = await User.findOne({
      email: emailId,
    });
    if (!userData) {
      return res.status(400).json({
        message: 'Account with given email not exist!!',
      });
    }

    const plainPassword = req.body.password;
    if (!validator.isStrongPassword(plainPassword)) {
      return res.status(400).json({
        message: `Password is not Strong!!Must contain atleast one Capital letter,1 small letter , 1 number and 1 unique character`,
      });
    }

    const encryptedPassword = await bcrypt.hash(plainPassword, 10);

    userData.password = encryptedPassword;

    await userData.save();
    res.send('Password Updated Successfully!!');
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = authRouter;
