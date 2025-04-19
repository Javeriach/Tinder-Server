const express = require('express');
const authentication = require('../MiddleWares/auth');
const { Chat } = require('../models/TwoPersonChat');
const chatRouter = express.Router();
const moongoose = require('mongoose');
const User = require('../models/User');
const { ObjectId } = moongoose.Types;

// ROUTE TO GET THE CHAT OF ONE CONTACT
chatRouter.get(
  '/oneUserchat/:targetUserId',
  authentication,
  async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader(
      'Access-Control-Allow-Origin',
      'https://tinder-frontend-code-bvpx.vercel.app'
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    let { targetUserId } = req.params;
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 300;
    limit = limit > 300 ? 200 : limit;
    let skip = (page - 1) * limit;

    try {
      if (!targetUserId) {
        return res.status(500).json({ msg: 'Invalid String' });
      }
      targetUserId = new ObjectId(targetUserId);
      const userId = req.body.userData._id;

      //===============================Query to get paginated data=======
      let chat = await Chat.aggregate([
        {
          $match: {
            participants: {
              $all: [userId, targetUserId],
            },
          },
        },
        {
          $project: {
            participants: 1,
            roomId: 1, // Include roomId as a string
            messages: {
              $cond: {
                if: { $gt: [{ $size: { $ifNull: ['$messages', []] } }, 0] }, // Check if messages array is not empty
                then: '$messages', // If true, use the messages array
                else: [], // If false, set messages to an empty array
              },
            },
          },
        },
        {
          $unwind: {
            path: '$messages',
            preserveNullAndEmptyArrays: true, // Preserve documents with empty messages array
          },
        },
        {
          $sort: { 'messages.timestamp': -1 }, // Sort messages by timestamp (newest first)
        },
        {
          $skip: skip, // Replace with your desired skip value
        },
        {
          $limit: limit, // Replace with your desired limit value
        },
        {
          $sort: { 'messages.timestamp': 1 }, // Sort messages by timestamp (newest first)
        },
        {
          $lookup: {
            from: 'users',
            localField: 'messages.senderId',
            foreignField: '_id',
            as: 'messages.senderId',
          },
        },
        {
          $addFields: {
            'messages.senderId': { $arrayElemAt: ['$messages.senderId', 0] },
          },
        },
        {
          $group: {
            _id: '$_id',
            participants: { $first: '$participants' },
            roomId: { $first: '$roomId' }, // Fixed: Use $first for roomId
            messages: {
              $push: {
                $cond: {
                  if: { $ne: ['$messages', null] }, // Check if messages is not null
                  then: '$messages', // If true, include the message
                  else: null, // If false, exclude the message
                },
              },
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'participants',
            foreignField: '_id',
            as: 'participants',
          },
        },
        {
          $project: {
            _id: 1,
            roomId: 1, // Include roomId in the final output
            messages: {
              $filter: {
                input: '$messages',
                as: 'message',
                cond: { $ne: ['$$message', null] }, // Remove null values from messages array
              },
            },
            friendData: {
              $filter: {
                input: '$participants',
                as: 'participant',
                cond: { $ne: ['$$participant._id', userId] }, // Exclude the current user
              },
            },
          },
        },
      ]);

      if (!chat?.length) {
        let contactdata = await User.findOne({ _id: targetUserId });
        const roomId = [userId, targetUserId].sort().join('_');
        chat = [
          {
            messages: [],
            roomId: roomId,
            friendData: [
              {
                _id: contactdata?._id,
                firstName: contactdata?.firstName,
                lastName: contactdata?.lastName,
                photoUrl: contactdata.photoUrl,
              },
            ],
          },
        ];
      }

      res.json(chat);
    } catch (error) {
      res.status(500).json({ msg: error.message });
    }
  }
);

//ROUTE TO GET ALL CHAT CONTACTS
chatRouter.get('/contacts', authentication, async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader(
    'Access-Control-Allow-Origin',
    'https://tinder-frontend-code-bvpx.vercel.app'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  try {
    const contacts = await Chat.aggregate([
      {
        $match: { participants: { $all: [req?.body?.userData._id] } }, // Match chats where the user is a participant
      },
      {
        $project: {
          _id: 1,
          messages: 1,
          roomId: 1, // Include roomId in the initial projection
          participants: {
            $filter: {
              input: '$participants',
              as: 'friend',
              cond: { $ne: ['$$friend', req?.body?.userData?._id] }, // Exclude the current user
            },
          },
          latestTimestamp: {
            $max: ['$updatedAt', '$createdAt'], // Use the latest of updatedAt or createdAt
          },
        },
      },
      {
        $lookup: {
          from: 'users', // Assuming the user data is in the 'users' collection
          localField: 'participants',
          foreignField: '_id',
          as: 'ContactData', // Populate participants' data
        },
      },
      {
        $sort: { latestTimestamp: -1 }, // Sort chats by the most recent activity
      },
      {
        $project: {
          _id: 1,
          roomId: 1, // Include roomId in the final projection
          ContactData: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            photoUrl: 1, // Include only necessary fields
          },
          latestTimestamp: 1,
        },
      },
    ]);

    res.json(contacts);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

module.exports = chatRouter;
