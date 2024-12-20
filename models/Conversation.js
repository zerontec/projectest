const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  users: [{type: mongoose.Types.ObjectId, ref: 'User'}],
  isGroup: Boolean,
  name: String,
  image: String,
  admin: {type: mongoose.Types.ObjectId},
  createdAt: {type: Date, default: Date.now}
});

module.exports = mongoose.model('Conversation', ConversationSchema);
