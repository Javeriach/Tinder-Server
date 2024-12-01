const express = require('express');
const app = express();
const connectDB = require('./config/database');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const cookieParser = require('cookie-parser');
const requestRouter = require('./routes/connectionRequest');
const userRouter = require('./routes/usersConnection');
const cors = require('cors');

//EXPRESS BUILT IN MIDDLEWARES
app.use(
  cors({
    origin: 'https://tinder-frontend-code.vercel.app',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

//EXPRESS ROUTERS
app.use('/', authRouter);
app.use('/', profileRouter);
app.use('/', requestRouter);
app.use('/', userRouter);

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
