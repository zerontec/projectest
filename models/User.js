const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  avatar: String,
  email: String,
  password: String,
  contacts: [{type: mongoose.Types.ObjectId, ref: 'User'}],
  notifications: [{type: mongoose.Types.ObjectId, ref: 'Notification'}],
  createdAt: {type: Date, default: Date.now},
});

UserSchema.methods.setPassword = function (password) {
  this.password = bcrypt.hashSync(password, 8);
};

UserSchema.methods.validatePassword = function (password) {
  return bcrypt.compareSync(password, this.password);
};

UserSchema.methods.generateJWT = function () {
  return jwt.sign(
    {
      id: this._id,
    },
    "secret"
  );
};

UserSchema.methods.toAuthJSON = function () {
  return {
    _id: this._id,
    email: this.email,
    token: this.generateJWT()
  };
};

module.exports = mongoose.model('User', UserSchema);
