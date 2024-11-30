var validator = require('validator');
const validateData = async (data) => {
  const { firstName, lastName, email, password } = data;
  if (!firstName || !lastName) {
    throw new Error('Name is not valid');
  } else if (!validator.isEmail(email)) {
    throw new Error('Email is not valid');
  } else if (!validator.isStrongPassword(password)) {
    throw new Error(`
      Your passwor is weak!!
      1-Length must be atleast 8.
      2-Must have atleast one capital letter
      3-Must have atleast one small letter
      4-Must have atleast one digit.`);
  }
};

const validateEditUpdates = async (req) => {
  const VALID_UPDATES = ['firstName', 'lastName', 'email', 'skills', 'age'];
  const requestedUpdates = req.body;
  const isAllRequestedUpdatesValid = Object.keys(req.body).every((field) =>
    VALID_UPDATES.includes(field)
  );
  return isAllRequestedUpdatesValid;
};

module.exports = {
  validateData,
  validateEditUpdates,
};
