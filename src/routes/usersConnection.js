const express = require('express');
const userRouter = express.Router();
const User = require('../models/User');
const authentication = require('../MiddleWares/auth');
const ConnectionRequest = require('../models/connectionrequest');

//GET ALL THE CONNECTIONS REQUEST LOGGIN USER HAVE
userRouter.get(
  '/request/connections/received',
  authentication,
  async (req, res) => {
    try {
      const loggedInUser = req.body.userData;

      const receivedConnections = await ConnectionRequest.find({
        toUserId: loggedInUser._id,
        status: 'interested',
      }).populate('fromUserId', ['firstName', 'lastName']);

      res.json({
        message: 'Data fetched Successfully',
        data: receivedConnections,
      });
    } catch (error) {
      res.status(500).send('Error: ' + error.message);
    }
  }
);

//GET ALL THE CONNECTIONS OF THE LOGGED IN USER ->MEANS ACCEPTED CONNECTIONS
userRouter.get(
  '/request/connections/Accepted',
  authentication,
  async (req, res) => {
    try {
      const loggedInUser = req.body.userData;
      const USER_SAFE_DATA = 'firstName lastName photoUrl skills about';

      let allAcceptedConnections = await ConnectionRequest.find({
        status: 'accepted',
        $or: [{ toUserId: loggedInUser._id }, { fromUserId: loggedInUser._id }],
      })
        .populate('fromUserId', USER_SAFE_DATA)
        .populate('toUserId', USER_SAFE_DATA);

      allAcceptedConnections = allAcceptedConnections.map((element) => {
        if (element.toUserId._id.toString() === loggedInUser._id.toString()) {
          return element.fromUserId;
        }

        return element.toUserId;
      });

      res.json({
        message: 'Data fetched successfully',
        data: allAcceptedConnections,
      });
    } catch (error) {
      res.status(500).send('ERROR: ' + error.message);
    }
  }
);

userRouter.get('/feed', authentication, async (req, res) => {
  const USER_SAFE_DATA = 'firstName lastName photoUrl skills about';
  const page = req.query.page || 1;
  let limit = req.query.limit || 10;
  limit = limit > 50 ? 50 : limit;
  const usersToBeSkipped = (page - 1) * limit;

  //FRISTLY WE FETCH ALL THE USERS IN CONNECTIONREQUEST COLLECTION TO GET ALL THE REQUESTS
  //THAT EITHER THE USER HAS SEND OR RECEIVED

  try {
    const loggedInUser = req.body.userData;
    const alreadyConnectedUsers = await ConnectionRequest.find({
      $or: [
        {
          toUserId: loggedInUser._id,
        },
        {
          fromUserId: loggedInUser._id,
        },
      ],
    });

    //WE STORED THE IDS OF ALL ALREADY CONNECTED USERS IN SET
    let UsersToHideFromFeed = new Set();
    alreadyConnectedUsers.forEach((request) => {
      UsersToHideFromFeed.add(request.toUserId.toString());
      UsersToHideFromFeed.add(request.fromUserId.toString());
    });

    //NOW FETCH ALL USERS OTHER THEN USERSTOHIDEFROMFEED AND THE USER ITSELF
    const usersFeedData = await User.find({
      $and: [
        { _id: { $nin: Array.from(UsersToHideFromFeed) } },
        { _id: { $ne: loggedInUser._id } },
      ],
    })
      .select(USER_SAFE_DATA)
      .skip(usersToBeSkipped)
      .limit(limit);

    res.json({ data: usersFeedData });
  } catch (error) {
    res.status(500).send('ERROR : ' + error.message);
  }
});

module.exports = userRouter;
