const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  conversationId: mongoose.Types.ObjectId,
  user: {type: mongoose.Types.ObjectId, ref: 'User'},
  text: String,
  image: String,
  file: String,
  fileName: String,
  seenBy: [{type: mongoose.Types.ObjectId}],
  createdAt: {type: Date, default: Date.now},
});

module.exports = mongoose.model('Message', MessageSchema);
