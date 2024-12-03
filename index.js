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
  // Setting a strong Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self';",
      "script-src 'self' https://vercel.live;", // Allows scripts from your domain and Vercel live reload
      "style-src 'self' 'unsafe-inline';", // Allows styles from your domain and inline styles
      "object-src 'none';", // Disallows <object> tags for security
      "img-src 'self' data:;", // Allows images from your domain and data URIs
      "connect-src 'self' https://vercel.live;", // Allows network requests to your domain and Vercel
      "font-src 'self' data:;", // Allows fonts from your domain and data URIs
      "frame-ancestors 'none';", // Prevents the app from being embedded in an iframe
    ].join(' ')
  );

  next(); // Pass control to the next middleware
});

app.use(express.json());
app.use(cookieParser());

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
    app.listen(7777, () => {
      console.log('Server started to listrning');
    });
  })
  .catch((err) => {
    console.log(err);
    console.log('Database connection failed!!');
  });

module.exports = app;
