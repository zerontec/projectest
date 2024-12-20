const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema({
  name: String,
  members: [{user: {type: mongoose.Types.ObjectId, ref: 'User'}, role: Number}], // 1 = admin , 2 = member , 3 = pending
  image: String,
  archived: Boolean,
  calendar: [{type: {notes: [], date: Date}, default: undefined}],
  tasks: [{type: mongoose.Types.ObjectId, ref: 'Task'}],
  history: [{title: String, createdAt: {type: Date, default: Date.now}}],
  createdAt: {type: Date, default: Date.now},
  mutedBy: {type: [{type: mongoose.Types.ObjectId, ref: 'User'}], default: undefined}
}, {
  toJSON: {virtuals: true}
});

module.exports = mongoose.model('Project', ProjectSchema);
