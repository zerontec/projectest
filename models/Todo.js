const mongoose = require("mongoose");

const TodoSchema = new mongoose.Schema({
  text: String,
  checked: Boolean,
  user: {type: mongoose.Types.ObjectId, ref: 'User'},
  project: {type: mongoose.Types.ObjectId, ref: 'Project'}
});

module.exports = mongoose.model('Todo', TodoSchema);
