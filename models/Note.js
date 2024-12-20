const mongoose = require("mongoose");

const NoteSchema = new mongoose.Schema({
  text: String,
  user: {type: mongoose.Types.ObjectId, ref: 'User'},
  project: {type: mongoose.Types.ObjectId, ref: 'Project'}
});

module.exports = mongoose.model('Note', NoteSchema);
