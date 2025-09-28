const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authentication = async (req, res, next) => {
  const { token } = req.cookies;
  try {
    if (!token) {
      return res.status(401).json({ message: 'Please Login!!' });
    }
    
    const encodedMessage = await jwt.verify(token, process.env.JWT_TOKEN);
    const { email } = encodedMessage;
    
    if (!email) {
      return res.status(401).json({ message: 'Authentication Failed' });
    }
    
    const userData = await User.findOne({ email });
    
    if (!userData) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    req.body.userData = userData;
    next();
  } catch (err) {
    console.error('Authentication error:', err.message);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Authentication error' });
  }
};
module.exports = authentication;
