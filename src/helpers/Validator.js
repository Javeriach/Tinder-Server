var validator = require('validator');
const validateData = async (data) => {
  const { firstName, lastName, email, password } = data;
  if (!firstName || !lastName) {
    throw new Error('Name is not valid');
  } else if (!validator.isEmail(email)) {
    throw new Error('Email is not valid');
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
