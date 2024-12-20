const mongoose = require("mongoose");

const InvitationSchema = new mongoose.Schema({
  user: {type: mongoose.Types.ObjectId, ref: 'User'},
  project: {type: mongoose.Types.ObjectId, ref: 'Project'},
});

module.exports = mongoose.model('Invitation', InvitationSchema);
