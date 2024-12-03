const express = require('express');
const app = express();
const connectDB = require('./src/config/database');
const authRouter = require('./src/routes/auth');
const profileRouter = require('./src/routes/profile');
const cookieParser = require('cookie-parser');
const requestRouter = require('./src/routes/connectionRequest');
const userRouter = require('./src/routes/usersConnection');
const cors = require('cors');

//EXPRESS BUILT IN MIDDLEWARES
app.use(
  cors({
    origin: 'https://tinder-frontend-code.vercel.app',
    credentials: true,
  })
);

// CSP Middleware for Enhanced Security
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' https://vercel.live; object-src 'none';`
  );
  next();
});

app.use(express.json());
app.use(cookieParser());

//EXPRESS ROUTERS
app.use('/', authRouter); // Routes for authentication
app.use('/', profileRouter); // Routes for profile management
app.use('/', requestRouter); // Routes for connection requests
app.use('/', userRouter); // Routes for user connections

//Creating the instace of the User that we want to create and want to add to the database

connectDB()
  .then(() => {
    console.log('App successfully conected to the database');
    app.listen(7777, () => {
      console.log('Server started to listrning');
    });
  })
  .catch((err) => {
    console.log(err);
    console.log('Database connection failed!!');
  });

module.exports = app;
