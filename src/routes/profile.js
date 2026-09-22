const express = require('express');
const profileRouter = express.Router();
const User = require('../models/User');
const authentication = require('../MiddleWares/auth');
const cookieParser = require('cookie-parser');
const { validateEditUpdates } = require('../helpers/Validator');
const bcrypt = require('bcrypt');
var validator = require('validator');
const cloudinary = require('../lib/cloudinary');

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

// Upload a profile photo (sent as a base64 data URL) to Cloudinary and
// return its hosted URL - the frontend then saves that URL via /profile/edit.
profileRouter.post('/profile/uploadPhoto', authentication, async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ message: 'No image provided.' });
    }

    const uploadResponse = await cloudinary.uploader.upload(image, {
      folder: 'tinder/profile-photos',
    });

    res.json({ url: uploadResponse.secure_url });
  } catch (error) {
    console.error('profile/uploadPhoto error:', error.message);
    res.status(500).json({ message: 'Photo upload failed. Please try again.' });
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

      let hashedPassword = await bcrypt.hash(password, 10);

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
