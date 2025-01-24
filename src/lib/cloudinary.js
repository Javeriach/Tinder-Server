const cloudinary = require('cloudinary').v2;
const config = require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME, // Add your cloud name
  api_key: process.env.CLOUDNARY_API_KEY, // Add your API key
  api_secret: process.env.CLOUDNARY_API_SECRET, // Add your API secret
});

module.exports = cloudinary;
