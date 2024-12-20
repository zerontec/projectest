const router = require('express').Router();
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const auth = require('../auth');
const {sendNotification} = require('../../config/notification');

const create = async (req, res, next) => {
  try {
    const notification = new Notification({title: req.body.title});
    await notification.save();
    await User.updateOne({_id: req.body.user}, {$push: {notifications: notification._id}});
    await sendNotification(req.body.title, [req.body.user]);
    res.status(200).json(notification);
  } catch (e) {
    next(e);
  }
};

const setSeen = async (req, res, next) => {
  try {
    const notification = await Notification.updateMany({_id: {$in: req.body.ids}}, {$set: {seen: true}});
    res.status(200).json(notification);
  } catch (e) {
    next(e);
  }
};

const remove = async (req, res, next) => {
  try {
    await Promise.all([
      Notification.deleteOne({_id: req.params.id}),
      User.updateOne({_id: req.payload.id}, {$pull: {notifications: req.params.id}})
    ]);
    res.status(200).json({ok: 1});
  } catch (e) {
    next(e);
  }
};

router.post("/", auth.required, create);
router.put("/setSeen", auth.required, setSeen);
router.delete("/:id", auth.required, remove);

module.exports = router;
