const { default: mongoose } = require('mongoose');
const connectDB = async () => {
  await mongoose.connect(
    'mongodb+srv://javeriakanwal383:poiuytrewq098@tinder.s6noe.mongodb.net/DevTinder'
  );
};
module.exports = connectDB;
