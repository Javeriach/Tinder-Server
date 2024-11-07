const moongoose = require('mongoose');
const connectionRequestSchema = new moongoose.Schema(
  {
    fromUserId: {
      type: moongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    toUserId: {
      type: moongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: {
        values: ['ignored', 'interested', 'accepted', 'rejected'],
        message: 'Invalid Status',
      },
    },
  },
  {
    timestamps: true,
  }
);
//MAKING THE COMPOUND INDEXES
connectionRequestSchema.index((fromUserId = 1), (toUserId = 1));

//CONNECTION METHODS
connectionRequestSchema.pre('save', function (next) {
  const currentConnectionRequest = this;
  //CHECK WHETHER THE LOGGED IN USER IS SENDING CONNECTION REQUEST TO HIMSELF OR NOT
  if (
    currentConnectionRequest.fromUserId.equals(
      currentConnectionRequest.toUserId
    )
  ) {
    throw new Error('Cannot send connection request to yourself');
  }

  next();
});

const ConnectionRequest = new moongoose.model(
  'ConnectionRequest',
  connectionRequestSchema
);
module.exports = ConnectionRequest;
