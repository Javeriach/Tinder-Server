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
      } else {
        // Opening a chat means the user has now seen its messages - record
        // that so /notifications doesn't keep resurfacing it after reload.
        await Chat.updateOne(
          { participants: { $all: [userId, targetUserId] } },
          { $set: { [`lastRead.${userId}`]: new Date() } }
        );
      }

      res.json(chat);
    } catch (error) {
      res.status(500).json({ msg: error.message });
    }
  }
);

//ROUTE TO GET ALL CHAT CONTACTS
chatRouter.get('/contacts', authentication, async (req, res) => {

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

//ROUTE TO GET UNREAD-MESSAGE NOTIFICATIONS (survives reload/reconnect, unlike
//the purely in-memory socket-driven notification list)
chatRouter.get('/notifications', authentication, async (req, res) => {
  try {
    const userId = String(req.body.userData._id);

    const chats = await Chat.find({ participants: req.body.userData._id })
      .populate('messages.senderId', 'firstName lastName photoUrl')
      .lean();

    const notifications = [];
    for (const chat of chats) {
      const lastMessage = chat.messages?.[chat.messages.length - 1];
      if (!lastMessage || !lastMessage.senderId) continue;
      if (String(lastMessage.senderId._id) === userId) continue; // last message is mine

      const lastReadAt = chat.lastRead?.[userId]
        ? new Date(chat.lastRead[userId])
        : new Date(0);
      if (new Date(lastMessage.createdAt) <= lastReadAt) continue; // already read

      notifications.push({
        senderId: lastMessage.senderId._id,
        roomId: chat.roomId,
        firstName: lastMessage.senderId.firstName,
        lastName: lastMessage.senderId.lastName,
        photoUrl: lastMessage.senderId.photoUrl,
        msg: lastMessage.text || '📷Photo',
        time: lastMessage.createdAt,
      });
    }

    notifications.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

module.exports = chatRouter;
