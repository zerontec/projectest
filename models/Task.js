const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  title: String,
  board: Number,
  order: Number,
  endDate: Date,
  members: {type: [{type: mongoose.Types.ObjectId, ref: 'User'}], default: undefined},
  comments: {type: [{type: mongoose.Types.ObjectId, ref: 'Comment'}], default: undefined},
  attachments: {type: [{type: mongoose.Types.ObjectId, ref: 'Attachment'}], default: undefined},
  tags: {type: [{_id: String, color: String, name: String}], default: undefined},
  todoGroup: {type: [{title: String, list: [{type: mongoose.Types.ObjectId, ref: 'Todo'}]}], default: undefined},
  archived: Boolean,
  desc: String,
  createdAt: {type: Date, default: Date.now}
});

module.exports = mongoose.model('Task', TaskSchema);
