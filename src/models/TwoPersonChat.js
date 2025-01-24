const moongoose = require('mongoose');

//SEPARATE SCHEMA FOR MESSAGES
const messageSchema = new moongoose.Schema(
  {
    senderId: {
      type: moongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
    },
    imageURL: {
      type: String,
    },
  },
  { timestamps: true }
);

//SCHEMA TO STORE THE MESSAGES
const chatSchema = new moongoose.Schema(
  {
    roomId: {
      type: String,
    },
    participants: [
      {
        type: moongoose.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    messages: [messageSchema],
  },
  { timestamps: true }
);
const Chat = moongoose.model('Chat', chatSchema);
module.exports = { Chat };
