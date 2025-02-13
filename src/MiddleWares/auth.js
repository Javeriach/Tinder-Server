const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authentication = async (req, res, next) => {
  const { token } = req.cookies;
  try {
    if (!token) {
      //
      return res.status(401).send('Please Login!!');
    } else {
      const encodedMessage = await jwt.verify(token, 'OnlyJeaa&*(');
      const { email } = encodedMessage;
      if (!email) throw new Error('Authentication Failed');
      const userData = await User.findOne({
        email,
      });
      if (!userData) throw new Error('User not exit');
      req.body.userData = userData;
      next();
    }
  } catch (err) {
    res.status(500).send('Error : ' + err.message);
  }
};
module.exports = authentication;
