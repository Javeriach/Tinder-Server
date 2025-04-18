require('dotenv').config();
const express = require('express');
const app = express();
const connectDB = require('./src/config/database');
const authRouter = require('./src/routes/auth');
const profileRouter = require('./src/routes/profile');
const cookieParser = require('cookie-parser');
const requestRouter = require('./src/routes/connectionRequest');
const userRouter = require('./src/routes/usersConnection');
const paymentRouter = require('./src/routes/payment.js');
const initializeSocket = require('./src/helpers/socket.js');
const chatRouter = require('./src/routes/chat');

const http = require('http');
const cors = require('cors');
require('./src/helpers/cronjobs');

app.use(
  cors({
    origin: 'https://tinder-frontend-code-bvpx.vercel.app',
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
app.use('/', paymentRouter); // Routes for payment
app.use('/', chatRouter); // Routes for Realtime chat

app.all('*', (req, res) => {
  res.status(404).json({ message: 'Path not found!!' });
});
//Creating the instace of the User that we want to create and want to add to the database

const httpServer = http.createServer(app);
initializeSocket(httpServer);

connectDB()
  .then(() => {
    console.log('App successfully conected to the database');
    httpServer.listen(7777, () => {
      console.log('Server started to listrning');
    });
  })
  .catch((err) => {
    console.log('Database connection failed!!');
  });

module.exports = app;
