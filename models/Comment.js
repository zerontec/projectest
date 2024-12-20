const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  content: String,
  user: {type: mongoose.Types.ObjectId, ref: 'User'},
  attachments: {type: [{type: mongoose.Types.ObjectId, ref: 'Attachment'}], default: undefined},
  createdAt: {type: Date, default: Date.now}
});

module.exports = mongoose.model('Comment', CommentSchema);
