const router = require('express').Router();
const Project = require('../../models/Project');
const User = require('../../models/User');
const Invitation = require('../../models/Invitation');
const Notification = require('../../models/Notification');
const auth = require('../auth');
const {getNotNullFields} = require('../../utils');
const {upload, getImageName} = require('../../config/storage');
const {ErrorHandler} = require('../../config/error');
const s3 = require('../../config/s3');
const {sendNotification} = require('../../config/notification');

const create = async (req, res, next) => {
  try {
    const {name, members} = req.body;
    const membersData = (members || []).map(m => ({user: m, role: 3}));
    const project = new Project({name, members: [{user: req.payload.id, role: 1}, ...membersData]});
    await project.save();
    if (members?.length) {
      const invitations = members.map(m => new Invitation({project: project._id, user: m}));
      await Promise.all(invitations.map(item => item.save()));
    }
    Project.populate(project, {path: 'members.user', select: 'firstName , avatar'}, function(err, item) {
      res.status(200).json(item);
    });
  } catch (e) {
    next(e);
  }
};

const getAll = async (req, res, next) => {
  try {
    const criterion = {"members": {$elemMatch: {$and: [{"user": req.payload.id}, {"role": {$ne: 3}}]}}};
    const projects = await Project.find(criterion, {calendar: 0, tasks: 0, history: 0})
      .populate('members.user', 'firstName , avatar');
    res.status(200).json(projects);
  } catch (e) {
    next(e);
  }
};

const search = async (req, res, next) => {
  try {
    const {q} = req.query;
    if (!q) return res.status(404).send("query is required");
    const query = {$regex: q, $options: 'i'};
    const data = await Project.find({name: query, "members.user": req.payload.id}, 'name');
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
};

const get = async (req, res, next) => {
  try {
    const project = await Project.findOne({_id: req.params.id, "members.user": req.payload.id})
      .populate('members.user', 'firstName , lastName , avatar , email')
      .populate({path: 'tasks', populate: [
          {path: 'members', select: 'firstName , lastName , avatar'},
          {path: 'attachments', select: 'src , type'},
          {path: 'todoGroup.list', select: 'checked'}
        ]});
    if (!project)
      return new ErrorHandler(401, `You are not authorized for this project`, [], res);
    res.status(200).json(project);
  } catch (e) {
    next(e);
  }
};

const getTasks = async (req, res, next) => {
  try {
    const project = await Project.findOne({_id: req.params.id}, {tasks: 1})
      .populate({path: 'tasks', populate: [
          {path: 'members', select: 'firstName , lastName , avatar'},
          {path: 'attachments', select: 'src , type'},
          {path: 'todoGroup.list', select: 'checked'}
        ]});
    res.status(200).json({tasks: project.tasks});
  } catch (e) {
    next(e);
  }
};

const update = async (req, res, next) => {
  try {
    const {name, image, archived, calendar} = req.body;
    const project = await Project.findOneAndUpdate(
      {_id: req.params.id},
      {$set: getNotNullFields({name, image, archived, calendar})},
      {new: true}
      );
    if (archived !== undefined || archived)
      await Project.updateOne({_id: project}, {$push: {history: {title: `The project has ${archived ? 'archived' : 'unarchived'}.`}}});
    res.status(200).json(project);
  } catch (e) {
    next(e);
  }
};

const updateLogo = async (req, res, next) => {
  try {
    const uploaded = await s3.upload(req.file, 'project', getImageName(req.file, req.params.id));
    await Project.updateOne({_id: req.params.id}, {$set: {image: uploaded.key}});
    res.status(200).json({path: uploaded.key});
  } catch (e) {
    next(e);
  }
};

const mute = async (req, res, next) => {
  try {
    const project = await Project.findOneAndUpdate({_id: req.params.id},
      {[req.body.mute ? '$addToSet' : '$pull']: {mutedBy: req.payload.id}}, {new: true});
    res.status(200).json({mutedBy: project.mutedBy});
  } catch (e) {
    next(e);
  }
};

const updateCalendar = async (req, res, next) => {
  try {
    await Project.updateOne({_id: req.params.id}, {$set: {calendar: req.body.data}});
    res.status(200).json({ok: 1});
  } catch (e) {
    next(e);
  }
};

const addMember = async (req, res, next) => {
  try {
    const {userId, email} = req.body;
    let newMember = userId;
    let user;
    if (email) {
      user = await User.findOne({email}, {email: 1, avatar: 1, firstName: 1, lastName: 1});
      if (!user) return new ErrorHandler(400, "The e-mail was not found in the system", [], res);
      else newMember = user._id;
    }
    const project = await Project.findOne({_id: req.params.id, "members.user": newMember}, {members: 1, name: 1, mutedBy: 1});
    if (project) return new ErrorHandler(400, "The user is already a member of the project", [], res);
    else {
      const invitation = new Invitation({project: req.params.id, user: newMember});
      await invitation.save();
      if (!user) user = await User.findOne({_id: newMember}, {email: 1, avatar: 1, firstName: 1, lastName: 1});
      const {name, mutedBy} = await Project.findOne({_id: req.params.id}, {name: 1, mutedBy: 1});
      const msg = `You have been invited to "${name}"`;
      const notification = await (new Notification({title: msg})).save();
      await sendNotification(msg, [userId], {}, mutedBy);
      await User.updateOne({_id: userId}, {$push: {notifications: notification._id}});
      const updatedData = await Project.findOneAndUpdate(
        {_id: req.params.id},
        {$push: {members: {user: newMember, role: 3}, notifications: notification._id,
            history: {title: `${user.firstName} was invited to the project.`}}},
        {new: true}
      );
      const data = {_id: updatedData.members[updatedData.members.length - 1]._id, user, role: 3};
      res.status(200).json({addedMember: data});
    }
  } catch (e) {
    next(e);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const {id, member} = req.params;
    if (req.query.leave) {
      await Project.updateOne({_id: id}, {$pull: {members: {user: req.payload.id}}});
      res.status(200).json({ok: 1});
    } else {
      const criterion = {_id: id, "members": {$elemMatch: {$and: [{"user": req.payload.id}, {"role": {$eq: 1}}]}}};
      const project = await Project.findOne(criterion).populate('members.user', '_id');
      if (!project) return new ErrorHandler(400, "You do not have permission to this operation", [], res);
      else {
        const user = project.members.find(m => m._id == member)?.user?._id;
        await Promise.all([
          Project.updateOne({_id: id}, {$pull: {members: {_id: member}}}),
          Invitation.deleteOne({project: id, user})
        ]);
        res.status(200).json({ok: 1});
      }
    }
  } catch (e) {
    next(e);
  }
};

const remove = async (req, res, next) => {
  try {
    await Project.deleteOne({_id: req.params.id});
    res.status(200).json({ok: 1});
  } catch (e) {
    next(e);
  }
};

router.post("/", auth.required, create);
router.get("/", auth.required, getAll);
router.get("/:id/get", auth.required, get);
router.get("/:id/tasks", auth.required, getTasks);
router.get("/search", auth.required, search);
router.put("/:id", auth.required, update);
router.post("/:id/member", auth.required, addMember);
router.put("/:id/mute", auth.required, mute);
router.put("/:id/calendar", auth.required, updateCalendar);
router.put("/:id/logo", [auth.required, upload.single('logo')], updateLogo);
router.delete("/:id/member/:member", auth.required, removeMember);
router.delete("/:id", auth.required, remove);

module.exports = router;
