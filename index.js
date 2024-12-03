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
    origin: ['https://tinder-frontend-code.vercel.app/'],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// CSP Middleware for Enhanced Security
// CSP Middleware for Enhanced Security
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self';", // Allow resources from the same origin
      "script-src 'self' 'unsafe-inline';", // Allow inline scripts and scripts from the same origin
      "style-src 'self' 'unsafe-inline';", // Allow inline styles and styles from the same origin
      "img-src 'self' data:;", // Allow images from self and data URIs
      "connect-src 'self';", // Allow network requests to self
      "font-src 'self';", // Allow fonts from self
      "object-src 'none';", // Disallow <object>, <embed>, <applet>
      "child-src 'none';", // Disallow the loading of any frames or workers
      "frame-src 'none';", // Disallow embedding in frames or iframes
      "frame-ancestors 'none';", // Prevent your content from being embedded into other websites
      "form-action 'self';", // Only allow forms to be submitted to the same origin
      "manifest-src 'self';", // Allow the manifest file to be loaded only from the same origin
      "base-uri 'self';", // Restrict base URIs to the same origin
      'upgrade-insecure-requests;', // Upgrade all HTTP requests to HTTPS
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
