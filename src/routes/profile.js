const express = require('express');
const profileRouter = express.Router();
const User = require('../models/User');
const authentication = require('../MiddleWares/auth');
const cookieParser = require('cookie-parser');
const { validateEditUpdates } = require('../helpers/Validator');
const bcrypt = require('bcrypt');
var validator = require('validator');

//GETTING THE USER DATA FROM THE DATABASE
profileRouter.get('/profile/view', authentication, async (req, res) => {
  try {
    const user = req.body.userData;
    res.send(user);
  } catch (err) {
    console.log(err.message);
    res.status(500).send('Something went wrong');
  }
});

//PROFILE EDIT
profileRouter.patch('/profile/edit', authentication, async (req, res) => {
  try {
    if (!validateEditUpdates(req)) {
      throw new Error('Invalid Requested updates');
    }

    const loggedInUser = req.body.userData;
    Object.keys(req.body).every((key) => {
      return (loggedInUser[key] = req.body[key]);
    });

    req.body.userData = loggedInUser;
    await loggedInUser.save();

    res.send({
      message: `${loggedInUser.firstName}! your profile has been updated!`,
      data: loggedInUser,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message,
    });
  }
});

//DELETING THE USER FROM THE DATABASE
profileRouter.delete('/profile/delete', authentication, async (req, res) => {
  try {
    const deleteresult = await User.deleteOne(req.body.userData);
    res.send('User deleted Successfully1');
  } catch (err) {
    res.status(500).send('Something Went Wrong');
  }
});

//FORGET THE PASSWORD
profileRouter.patch(
  '/profile/resetPassword',
  authentication,
  async (req, res) => {
    try {
      if (!validator.isStrongPassword(req.body.password)) {
        throw new Error('Invalid Password!');
      }
      const password = req.body.password;
      console.log(password);
      let hashedPassword = await bcrypt.hash(password, 10);
      console.log(hashedPassword);
      let loggedInUser = req.body.userData;

      loggedInUser['password'] = hashedPassword;

      await loggedInUser.save();

      req.body.userData = await User.findOne({ _id: loggedInUser._id });
      res.send('Password successfully Updated!');
    } catch (err) {
      res.status(500).send('Error : ' + err.message);
    }
  }
);

module.exports = profileRouter;
