const mongoose = require('mongoose');
var validator = require('validator');

const userSchema = mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      minLength: 5,
      maxLength: 30,
    },
    lastName: {
      type: String,
      required: true,
      minLength: 5,
      maxLength: 30,
    },

    email: {
      type: String,
      lowercase: true,
      required: true,
      unique: true,
      trim: true,
    },

    age: {
      type: Number,
      min: 18,
      max: 90,
    },

    password: {
      type: String,
      required: true,
      validate(value) {
        if (!validator.isStrongPassword(value)) {
          throw new Error('Password is not strong enough!!');
        }
      },
    },

    about: {
      type: String,
      default: 'I am the default about',
    },

    skills: {
      type: [String],
    },

    photoUrl: {
      type: String,
    },
    gender: {
      type: String,
      validate(value) {
        if (!['female', 'male', 'other'].includes(value)) {
          throw new Error('Gender data is not valid');
        }
      },
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);
module.exports = User;
