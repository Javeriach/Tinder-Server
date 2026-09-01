const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { Chat } = require('../models/TwoPersonChat');
const cloudinary = require('../lib/cloudinary');
const { allowedOrigins } = require('../config/cors');

// Redis SET holding the ids of currently-online users.
const ONLINE_KEY = 'tinder:online_users';

// A single WebSocket connection is pinned to one serverless instance, but two
// users in the same chat can land on different instances. The Redis adapter
// makes `io.to(room).emit(...)` reach sockets on every instance, and the shared
// SET makes the online-users list consistent. Locally (no REDIS_URL) we fall
// back to in-process state, which is fine for one always-on server.
const initializeSocket = async (server) => {
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  let redis = null;
  const localOnline = new Set();

  if (process.env.REDIS_URL) {
    try {
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      pubClient.on('error', (e) => console.error('Redis pub error:', e.message));
      subClient.on('error', (e) => console.error('Redis sub error:', e.message));
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      redis = pubClient; // a normal client - fine for SET commands
      console.log('Socket.IO Redis adapter connected');
    } catch (err) {
      console.error('Redis adapter setup failed, using in-memory state:', err.message);
    }
  } else {
    console.warn('REDIS_URL not set - Socket.IO running single-instance only');
  }

  const addOnline = async (userId) =>
    redis ? redis.sAdd(ONLINE_KEY, userId) : localOnline.add(userId);
  const removeOnline = async (userId) =>
    redis ? redis.sRem(ONLINE_KEY, userId) : localOnline.delete(userId);
  const getOnline = async () =>
    redis ? redis.sMembers(ONLINE_KEY) : [...localOnline];
  const broadcastOnline = async () => {
    try {
      io.emit('getOnlineUsers', await getOnline());
    } catch (e) {
      console.error('broadcastOnline failed:', e.message);
    }
  };

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    console.log('A user connected', socket.id, userId);

    if (userId) {
      // Personal room: every socket this user opens joins it, so a message can
      // be delivered with io.to(`user:<id>`) regardless of which instance holds
      // the target socket.
      socket.join(`user:${userId}`);
      addOnline(userId).then(broadcastOnline).catch(() => {});
    }

    socket.on('joinChat', ({ userId: u, targetUserId }) => {
      if (!u || !targetUserId) return;
      const roomId = [u, targetUserId].sort().join('_');
      socket.join(roomId);
    });

    socket.on(
      'sendMessage',
      async ({ userId: fromId, targetUserId, msgText, imageUrl: msg_Image }) => {
        try {
          if (!fromId || !targetUserId || (!msgText && !msg_Image)) {
            console.error('Invalid message data received.');
            return;
          }

          let image_url = '';
          if (msg_Image) {
            const uploadResponse = await cloudinary.uploader.upload(msg_Image);
            image_url = uploadResponse.secure_url;
          }

          const roomId = [fromId, targetUserId].sort().join('_');

          let chat = await Chat.findOne({
            participants: { $all: [fromId, targetUserId] },
            roomId: { $eq: roomId },
          });

          if (!chat) {
            chat = await Chat({
              participants: [fromId, targetUserId],
              messages: [],
              roomId,
            });
            await chat.save();
          }

          chat.messages.push({
            senderId: fromId,
            text: msgText,
            imageURL: image_url,
            timestamp: new Date(),
          });
          chat = await chat.save();

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
            (person) => person._id.toString() === targetUserId
          );
          const last =
            populatedChat.messages[populatedChat.messages.length - 1];

          const savedMessage = {
            ContactData: filteredContacts[0],
            roomId,
            newMessage: {
              text: last.text,
              senderId: last.senderId,
              imageURL: last.imageURL,
              createdAt: last.createdAt,
            },
            latestTimestamp: new Date().toISOString(),
          };

          io.to(`user:${fromId}`).emit('messageReceived', savedMessage);
          io.to(`user:${targetUserId}`).emit('messageReceived', savedMessage);

          console.log(`Message sent in room ${roomId}`);
        } catch (error) {
          console.error('Error in message handling:', error);
          io.to(`user:${fromId}`).emit('ImageProblem', 'Network Error');
        }
      }
    );

    socket.on('disconnect', async () => {
      console.log('User disconnected', socket.id);
      if (!userId) return;
      try {
        // Mark offline only once this user has no sockets left anywhere
        // (multi-tab / multi-device safe). fetchSockets() spans all instances
        // when the Redis adapter is active.
        const remaining = await io.in(`user:${userId}`).fetchSockets();
        if (remaining.length === 0) {
          await removeOnline(userId);
          await broadcastOnline();
        }
      } catch (e) {
        await removeOnline(userId).catch(() => {});
      }
    });
  });
};

module.exports = initializeSocket;
