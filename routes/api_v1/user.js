const router = require('express').Router();
const User = require('../../models/User');
const Invitation = require('../../models/Invitation');
const Project = require('../../models/Project');
const auth = require('../auth');
const {ErrorHandler} = require('../../config/error');
const {getNotNullFields} = require('../../utils');
const {upload, getImageName} = require('../../config/storage');
const s3 = require('../../config/s3');

const profileFields = {contacts: 0, password: 0};

const create = async (req, res, next) => {
  try {
    const {firstName, lastName, email, password} = req.body;
    const missingFields = [];
    if (!firstName) missingFields.push('First Name');
    if (!lastName) missingFields.push('Last Name');
    if (!password) missingFields.push('Password');

    if (missingFields.length > 0)
      return new ErrorHandler(400, "Missing fields: " + missingFields.toString(), missingFields, res);

    const alreadyHave = await User.findOne({email: email.toLowerCase()});
    if (alreadyHave)
      return new ErrorHandler(409, `This email already taken. Please try with a different email`, [], res);

    const user = {email: email.toLowerCase(), firstName, lastName, password};
    const finalUser = new User(user);
    finalUser.setPassword(user.password);

    return finalUser
      .save()
      .then(async data => {
        const userWithToken = {...data.toJSON()};
        delete userWithToken['password'];
        userWithToken.token = finalUser.generateJWT();
        return res.status(200).json(userWithToken);
      })
      .catch(async e => {
        return new ErrorHandler(400, "An error occurred during user creation, please try again later.", [], res);
      });
  } catch (e) {
    next(e);
  }
};

const login = async (req, res, next) => {
  try {
    const {email, password} = req.body;
    if (email && password) {
      const user = await User.findOne({email});
      if (!user || !user.validatePassword(password)) return new ErrorHandler(400, "Email or password is invalid", [], res);
      const finalData = {token: await user.generateJWT(), ...user.toJSON()};
      delete finalData['password'];
      res.status(200).json(finalData);
    } else
      new ErrorHandler(404, "Missing required fields", [], res);
  } catch (e) {
    next(e);
  }
};

const search = async (req, res, next) => {
  try {
    const {q} = req.query;
    if (!q) return res.status(404).send("query is required");
    const query = {$regex: q, $options: 'i'};
    const data = await User.find(
      {$and: [{$or: [{firstName: query}, {lastName: query}, {email: query}]}, {_id: {$ne: req.payload.id}}]}
      , profileFields);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

const get = async (req, res, next) => {
  try {
    const data = await User.findOne({_id: req.params.id}, profileFields);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const data = await User.findOne({_id: req.payload.id}, {password: 0}).populate('notifications')
      .populate({path: 'contacts', select: 'firstName , lastName , avatar , phone , email'});
    let tasks = [];
    const projects = await Project.find({"members.user": req.payload.id}, {tasks: 1})
      .populate('tasks', 'board');
    projects.forEach(p => tasks = [...tasks, ...(p.tasks || [])]);
    res.status(200).json({...data._doc, tasks});
  } catch (e) {
    next(e);
  }
};

const update = async (req, res, next) => {
  try {
    const {firstName, lastName} = req.body;
    const data = await User.findOneAndUpdate(
      {_id: req.payload.id},
      {$set: {...getNotNullFields({firstName, lastName})}},
      {new: true},
    ).select({password: 0, notifications: 0});
    res.json(data);
  } catch (e) {
    next(e);
  }
};

const updateAvatar = async (req, res, next) => {
  try {
    const uploaded = await s3.upload(req.file, 'user', getImageName(req.file, req.payload.id));
    await User.updateOne({_id: req.payload.id}, {$set: {avatar: uploaded.key}});
    res.status(200).json({path: uploaded.key});
  } catch (e) {
    next(e);
  }
};

const getInvitations = async (req, res, next) => {
  try {
    const invitations = await Invitation.find({user: req.payload.id}).populate('project', 'name , image');
    res.status(200).json(invitations);
  } catch (e) {
    next(e);
  }
};

const acceptInvitation = async (req, res, next) => {
  try {
    const {invitationId} = req.body;
    const invitation = await Invitation.findOne({_id: invitationId});
    if (!invitation) return new ErrorHandler(400, "Invitation not found", [], res);
    else {
      const user = await User.findOne({_id: invitation.user}, {firstName: 1});
      const project = await Project.findOneAndUpdate(
        {_id: invitation.project, "members.user": invitation.user},
        {$set: {"members.$.role": 2}, $push: {history: {title: `${user.firstName} joined the project.`}}}
      );
      const owner = project.members[0].user;
      await Promise.all([
        User.updateOne({_id: invitation.user}, {$addToSet: {contacts: owner}}),
        User.updateOne({_id: owner}, {$addToSet: {contacts: invitation.user}}),
        Invitation.deleteOne({_id: invitationId})
      ]);
      res.status(200).json({ok: 1});
    }
  } catch (e) {
    next(e);
  }
};

const declineInvitation = async (req, res, next) => {
  try {
    const {invitationId} = req.body;
    const invitation = await Invitation.findOne({_id: invitationId});
    if (!invitation) new ErrorHandler(400, "Invitation not found", [], res);
    else {
      await Promise.all([
        Project.updateOne({_id: invitation.project, "members.user": invitation.user}, {$pull: {members: {"user": invitation.user}}}),
        Invitation.deleteOne({_id: invitationId})
      ]);
      res.status(200).json({ok: 1});
    }
  } catch (e) {
    next(e);
  }
};

const remove = async (req, res, next) => {
  try {
    await User.deleteOne({_id: req.payload.id});
    res.json({ok: 1});
  } catch (e) {
    next(e);
  }
};

router.post("/", create);
router.post("/login", login);
router.get("/", auth.required, getProfile);
router.get("/search", auth.required, search);
router.get("/:id/get", auth.required, get);
router.get("/invitations", auth.required, getInvitations);
router.post("/invitation/accept", auth.required, acceptInvitation);
router.post("/invitation/decline", auth.required, declineInvitation);
router.put("/", auth.required, update);
router.put("/avatar", [auth.required, upload.single('avatar')], updateAvatar);
router.delete("/:id", auth.required, remove);

module.exports = router;
