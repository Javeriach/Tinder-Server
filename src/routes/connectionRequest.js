const express = require('express');
const requestRouter = express.Router();
const authentication = require('../MiddleWares/auth');
const ConnectionRequest = require('../models/connectionrequest');
const User = require('../models/User');
const sendEmail = require('../helpers/sendEmail');

requestRouter.post(
  '/request/send/:status/:toUserId',
  authentication,
  async (req, res) => {

     try {
      const fromUserId = req.body.userData._id;
      const toUserId = req.params.toUserId;
      const status = req.params.status;
      const senderData = req.body.userData;
      //CHECK WHETHER IS STATUS IS ACCORING TO THIS API
      const allowedStatus = ['ignored', 'interested'];
      if (!allowedStatus.includes(status)) {
        return res.status(400).send('ERROR: Invalid status request');
      }

      //***CHECK WHETHER THE OTHER USER EXIT IN DB OR NOT */
      const receiverData = await User.findOne({ _id: toUserId });
      if (!receiverData) {
        return res.status(400).json({ message: 'Receiver not Exit!!' });
      }

      //** CHECK WHETHER THE CONNECTION EXIST OR NOT*/
      const existingConnectionRequest = await ConnectionRequest.findOne({
        $or: [
          {
            toUserId,
            fromUserId,
          },
          {
            toUserId: fromUserId,
            fromUserId: toUserId,
          },
        ],
      });

      if (existingConnectionRequest) {
        return res
          .status(400)
          .json({ message: 'ERROR: Connection already exist!' });
      }

      //HERE WE ARE MAKING THE INSTANCE OF THE CONNECTION REQUEST AND STORIBG IT IN THE
      //DATABASE
      const newConnectionRequest = new ConnectionRequest({
        toUserId,
        fromUserId,
        status,
      });

      //LETS SAVE IT TO THE DATABASE
      const resultData = await newConnectionRequest.save();
      //NOW WE ARE SENDING THE EMAIL TO THE OWNER BY USING SENDEMAIL FROM AWS
      const sendRes = await sendEmail.run(
        'Tinder Connection Request',
        status === 'interested'
          ? `${senderData.firstName}! Your are interested in ${receiverData.firstName} ${receiverData.lastName}`
          : `${senderData.firstName} ${senderData.lastName}! You have ignored ${receiverData.firstName} ${receiverData.lastName}`
      );

      //WE ARE SENDING BACK THE RESPONCE IN JSON FORMAT
      res.json({
        message:
          status === 'interested'
            ? `${senderData.firstName}! Your are interested in ${receiverData.firstName} ${receiverData.lastName}`
            : `${senderData.firstName} ${senderData.lastName}! You have ignored ${receiverData.firstName} ${receiverData.lastName}`,
        data: resultData,
      });
    } catch (error) {
      console.log(error);
      res.status(500).send('Error :' + error.message);
    }
  }
);

//REVIEW THE REQUEST->EITHER ACCEPT THE REQUEST OF "REJECTED" THE "REQUEST"
//FOR THIS->STATUS MUST BE "INTERESTED" BEFORE THEN WE CAN REJECT OR ACCEPT-
//ALL THE ABOVE IS HAPPING ON THE RECEIVER SIDE

requestRouter.post(
  '/request/review/:status/:requestId',
  authentication,
  async (req, res) => {
    try {
      const allowedStatus = ['accepted', 'rejected'];
      const requestId = req.params.requestId;
      //FIRST CHECK EITHER THE COMING STATUS IS ACCESSPTED OR REJECTED
      const status = req.params.status.toLocaleLowerCase();
      if (!allowedStatus.includes(status)) {
        return res
          .status(400)
          .json({ message: 'Invalid Status not allowed!!' });
      }

      //CHECKING THE VALIDITY OF THE REQUEST->RECEIVER MUST BE LOGGED IN USER,REQUEST SHOULD
      //EXIST IN THE DATABASE

      const requestData = await ConnectionRequest.findOne({
        _id: requestId,
        toUserId: req.body.userData._id,
        status: 'interested',
      });

      if (!requestData) {
        return res.status(400).json({
          message: 'Invalid request not allowed!!',
          data: requestData,
        });
      }

      requestData.status = status;
      const updatedRequestData = await requestData.save();

      //FETCH THE SEND DATA TO GET HIS NAME
      const senderData = await User.findById(requestData.fromUserId);

      if (!senderData) {
        return res.status(400).json({ message: 'Sender not exit!!' });
      }
      return res.json({
        message: `${req.body.userData.firstName} ${status} ${senderData?.firstName}'s request!`,
        data: updatedRequestData,
      });
    } catch (error) {
      res.status(500).send('ERROR: ' + error.message);
    }
  }
);

module.exports = requestRouter;
