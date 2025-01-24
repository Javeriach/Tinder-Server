const socket = require('socket.io');
const { Chat } = require('../models/TwoPersonChat');
const cloudinary = require('../lib/cloudinary');
const mongoose = require('mongoose');

const initializeSocket = (server) => {
  const io = socket(server, {
    cors: {
      origin: 'http://localhost:5173',
    },
  });

  const userSocketMap = {}; //TO STORE ONLINE USERS

  io.on('connection', (socket) => {
    console.log('A user connected ', socket.id);

    //-=====TO GET ONLINE USERS
    const userId = socket.handshake.query.userId;
    console.log('--------', userId);
    if (userId) {
      userSocketMap[userId] = socket.id;
    }
    console.log(Object.keys(userSocketMap));
    io.emit('getOnlineUsers', Object.keys(userSocketMap));

    //======JOIN CHAT
    socket.on('joinChat', ({ userId, targetUserId }) => {
      if (!userId || !targetUserId) {
        console.error('Invalid user IDs received.');
        return;
      }
      // Create a unique room ID based on user IDs
      const roomId = [userId, targetUserId].sort().join('_');
      socket.join(roomId);
      console.log(`User ${userId} joined room: ${roomId}`);
    });

    socket.on(
      'sendMessage',
      async ({ userId, targetUserId, msgText, imageUrl: msg_Image }) => {
        try {
          if (!userId || !targetUserId || (!msgText && !msg_Image)) {
            console.error('Invalid message data received.');
            return;
          }

          console.log('HI========');
          //=======UPLOAD IMAGE TO CLOUDINARY=========================
          let image_url = '';
          if (msg_Image) {
            const uploadResponse = await cloudinary.uploader.upload(msg_Image);
            image_url = uploadResponse.secure_url;
          }

          //=======CREATE A UNIQUE ROOM ID FOR CHAT====================
          const roomId = [userId, targetUserId].sort().join('_');

          //=========FIND THE CHAT WITH BOTH PARTICIPANTS===============
          let chat = await Chat.findOne(
            {
              participants: { $all: [userId, targetUserId] },
              roomId: { $eq: roomId },
            } //  Find chat with both participants
          );

          if (!chat) {
            chat = await Chat({
              participants: [userId, targetUserId],
              messages: [],
              roomId: roomId,
            });

            await chat.save();
          }
          //=======PUSH THE NEW MESSAGE TO CHAT=========================
          chat.messages.push({
            senderId: userId,
            text: msgText,
            imageURL: image_url,
            timestamp: new Date(), // Add timestamp for the message
          });

          //=====SAVE THE CHAT WITH NEW MESSAGE=========================
          chat = await chat.save();

          //=======POPULATE THE CHAT WITH SENDER AND PARTICIPANTS DATA=====
          const populatedChat = await Chat.findById(chat._id)
            .populate({
              path: 'messages.senderId',
              select: 'firstName lastName photoUrl',
            })
            .populate({
              path: 'participants',
              select: 'firstName lastName photoUrl',
            });

          const filteredContacts = populatedChat.participants.filter(
            (person) => {
              console.log(person._id, targetUserId);
              return person._id.toString() === targetUserId;
            }
          );

          //=====PREPARE THE MESSAGE TO SEND============
          const savedMessage = {
            ContactData: filteredContacts[0],
            roomId: roomId,
            newMessage: {
              text: populatedChat.messages[populatedChat.messages.length - 1]
                .text,
              senderId:
                populatedChat.messages[populatedChat.messages.length - 1]
                  .senderId,
              imageURL:
                populatedChat.messages[populatedChat.messages.length - 1]
                  .imageURL,
            },
            latestTimestamp: new Date().toISOString(),
          };

          //====EMIT THE MESSAGE TO THE ROOM=========
          io.to(userSocketMap[userId]).emit('messageReceived', savedMessage);
          io.to(userSocketMap[targetUserId]).emit(
            'messageReceived',
            savedMessage
          );

          console.log('Message sent to room:', userId, targetUserId, roomId);
          console.log(`Message sent to room ${roomId}: ${msgText}`);
        } catch (error) {
          io.to(userSocketMap[targetUserId]).emit(
            'ImageProblem',
            'Network Error'
          );
          console.error('Error in message handling:', error);
        }
      }
    );

    //=====ON DICONNECTING THE SOCKET WE WILL DELETE THE USER FROM ONLINE USERS
    socket.on('disconnect', () => {
      console.log('User disconnected', socket.id);
      delete userSocketMap[userId];
      io.emit('getOnlineUsers', Object.keys(userSocketMap));
    });
  });
};

module.exports = initializeSocket;
