const express = require('express');
const authRouter = express.Router();
const User = require('../models/User');
const authentication = require('../MiddleWares/auth');
const { validateData } = require('../helpers/Validator');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

//=================================Sign Up user

authRouter.post('/auth/signup', async (req, res) => {
  try {
    validateData(req.body);
    const plainPassword = req.body.password;
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
    await UserInstance.save();
    // throw new Error('Something went wrong');
    res.send('User added successfully');
  } catch (err) {
    res.status(500).send('Error :' + err.message);
  }
});

//=================================Login User
authRouter.get('/auth/login', async (req, res) => {
  const { password, email } = req.body;
  try {
    if (!password || !email) {
      throw new Error('Email or password is incorrect');
    }
    const userData = await User.findOne({
      email,
    });
    if (!userData) {
      throw new Error('User not exist!!');
    }

    const varifiedPassword = await bcrypt.compare(password, userData.password);
    if (!varifiedPassword) throw new Error('Password is incorrect!!!');
    const token = await jwt.sign(
      {
        email,
      },
      'OnlyJeaa&*('
    );
    res.cookie('token', token); //BITF21M519
    res.send('Logged in Successfully' + '   ' + userData);
  } catch (err) {
    res.status(500).send('Error :' + err.message);
  }
});

authRouter.post('/auth/logout', async (req, res) => {
  res.cookie('token', null, { expires: new Date(Date.now()) });
  res.send('Logout Successfully');
});

authRouter.post('/forgetPassword', async (res, req) => {
  try {
    const emailId = req.body.emailId;
    const userData = await User.find({
      email: emailId,
    });
    if (!userData) {
      return res.status(400).json({
        message: 'Invalid Email address!!',
      });
    }

    const plainPassword = req.body.password;
  } catch (error) {
    res.status(500).send('ERROR: ' + error.message);
  }
});

module.exports = authRouter;
