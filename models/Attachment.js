const mongoose = require("mongoose");

const AttachmentSchema = new mongoose.Schema({
  createdAt: {type: Date, default: Date.now},
  name: String,
  src: String,
  type: String,
  size: Number
});

module.exports = mongoose.model('Attachment', AttachmentSchema);
