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
    origin: ['https://tinder-frontend-code.vercel.app'],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// CSP Middleware for Enhanced Security
app.use((req, res, next) => {
  // Setting a Content Security Policy to allow framing from vercel.live
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self';", // Default policy: only allow resources from the same origin
      "script-src 'self' https://vercel.live;", // Allow scripts from self and vercel.live
      "style-src 'self' 'unsafe-inline';", // Allow styles from self and inline styles
      "object-src 'none';", // Disallow <object> and <embed> tags
      "img-src 'self' data:;", // Allow images from self and data URIs
      "connect-src 'self' https://vercel.live;", // Allow network requests to self and vercel
      "font-src 'self' data:;", // Allow fonts from self and data URIs
      "frame-src 'self' https://vercel.live;", // Allow framing of content from self and vercel.live
      "frame-ancestors 'none';", // Prevent embedding of your app in other frames
    ].join(' ')
  );

  next(); // Pass control to the next middleware
});

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
