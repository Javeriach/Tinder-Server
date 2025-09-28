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
require('./src/helpers/cronjobs'); // Cron jobs with AWS credential checks

// Validate required environment variables
const requiredEnvVars = ['MONGODB_CONNECTION_STRING', 'JWT_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.all('*', (req, res) => {
  res.status(404).json({ message: 'Path not found!!' });
});
//Creating the instace of the User that we want to create and want to add to the database

const httpServer = http.createServer(app);
initializeSocket(httpServer);

connectDB()
  .then(() => {
    console.log('App successfully connected to the database');
    const PORT = process.env.PORT || 7777;
    httpServer.listen(PORT, () => {
      console.log(`Server started listening on port ${PORT}`);
    });
    
    // Handle server errors
    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please kill the existing process or use a different port.`);
        console.error('To kill existing processes on this port, run: lsof -ti:7777 | xargs kill -9');
      } else {
        console.error('Server error:', err);
      }
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
