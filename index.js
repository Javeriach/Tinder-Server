require('dotenv').config();
const express = require('express');
const app = express();
const connectDB = require('./src/config/database');
const authRouter = require('./src/routes/auth');
const profileRouter = require('./src/routes/profile');
const cookieParser = require('cookie-parser');
const requestRouter = require('./src/routes/connectionRequest');
const userRouter = require('./src/routes/usersConnection');
const cors = require('cors');

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// CSP Middleware for Enhanced Security

//EXPRESS ROUTERS
app.use('/', authRouter); // Routes for authentication
app.use('/', profileRouter); // Routes for profile management
app.use('/', requestRouter); // Routes for connection resquests
app.use('/', userRouter); // Routes for user connections
app.all('*', (req, res) => {
  res.status(404).json({ message: 'Path not found!!' });
});
//Creating the instace of the User that we want to create and want to add to the database

connectDB()
  .then(() => {
    console.log('App successfully conected to the database');
    app.listen(8888, () => {
      console.log('Server started to listrning');
    });
  })
  .catch((err) => {
    console.log('Database connection failed!!');
  });

module.exports = app;
