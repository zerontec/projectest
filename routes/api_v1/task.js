const router = require('express').Router();
const Project = require('../../models/Project');
const Task = require('../../models/Task');
const Attachment = require('../../models/Attachment');
const Comment = require('../../models/Comment');
const Todo = require('../../models/Todo');
const auth = require('../auth');
const {getNotNullFields, getFileName} = require('../../utils');
const {upload, getImageName} = require('../../config/storage');
const s3 = require('../../config/s3');
const mongoose = require('mongoose');

const create = async (req, res, next) => {
  try {
    const {title, project, board, order} = req.body;
    const task = new Task({title, board, order});
    await task.save();
    await Project.updateOne({_id: project}, {$push: {tasks: task._id, history: {title: `"${title.substring(0, 10)}" task has created.`}}});
    res.status(200).json(task);
  } catch (e) {
    next(e);
  }
};

const get = async (req, res, next) => {
  try {
    const data = await Promise.all([
      Task.findOne({_id: req.params.id}).populate('attachments')
        .populate('todoGroup.list')
        .populate('members', 'firstName , lastName , avatar')
        .populate('attachments', 'type , src , name , size')
        .populate({path: 'comments', populate: [
            {path: 'user', select: {firstName: 1, lastName: 1, avatar: 1}},
            {path: 'attachments', select: {src: 1, type: 1, name: 1, size: 1}},
          ]}),
    ]);
    res.status(200).json({...data[0].toJSON()});
  } catch (e) {
    next(e);
  }
};

const update = async (req, res, next) => {
  try {
    const {title, desc, board, order, endDate, members, tags, archived} = req.body;
    const data = getNotNullFields({title, board, order, endDate, tags, archived, desc});
    if (Array.isArray(tags) && tags.length === 0) data['tags'] = [];
    if (Array.isArray(members)) data['members'] = members;
    const task = await Task.findOneAndUpdate(
      {_id: req.params.id},
      {$set: data},
      {new: true}
    );
    res.status(200).json(task);
  } catch (e) {
    next(e);
  }
};

const updateMultiple = async (req, res, next) => {
  try {
    const {tasks} = req.body;
    const reqs = [];
    tasks.map(t => t._id);
    tasks.forEach(item => reqs.push(Task.updateOne({_id: item._id}, {$set: getNotNullFields(item)})));
    await Promise.all(reqs);
    res.status(200).json({ok: 1});
  } catch (e) {
    next(e);
  }
};

const duplicate = async (req, res, next) => {
  try {
    const duplicateItem = await Task.findOne({_id: req.params.id}, {comments: 0, todoGroup: 0, archived: 0, _id: 0, createdAt: 0});
    const _id = new mongoose.Types.ObjectId();
    const item = {...duplicateItem._doc, _id};
    const a = await Task.create(item);
    await Project.updateOne({_id: req.body.project}, {$push: {tasks: _id}});
    res.status(200).json(a);
  } catch (e) {
    next(e);
  }
};

const uploadFiles = async (req, res, next) => {
  try {
    const requests = [];
    const newReq = [];
    for (const file of req.files) {
      requests.push(s3.upload(file, 'attachment', getImageName(file)));
    }
    const uploadedFiles = await Promise.all(requests);
    uploadedFiles.forEach((file, index) => {
      const {mimetype, size, filename} = req.files[index];
      newReq.push((new Attachment({src: file.key, type: mimetype, size, name: getFileName(filename)})).save())
    });
    const savedAttachments = await Promise.all(newReq);
    await Task.updateOne(
      {_id: req.params.id},
      {$push: {attachments: savedAttachments.map(a => a._id)}},
    );
    res.status(200).json({task: req.params.id, uploadedAttachments: savedAttachments});
  } catch (e) {
    next(e);
  }
};

const removeAttachment = async (req, res, next) => {
  try {
    const file = await Attachment.findOne({_id: req.params.file}, {src: 1});
    await Promise.all([
      Task.updateOne({_id: req.params.id}, {$pull: {attachments: req.params.file}}),
      Attachment.deleteOne({_id: req.params.file}),
      s3.remove(file.src)
    ]);
    res.send({deletedFile: file._id});
  } catch (e) {
    next(e);
  }
};

const createTodoGroup = async (req, res, next) => {
  try {
    const _id = new mongoose.Types.ObjectId();
    const data = {_id, title: req.body.title, list: []};
    await Task.updateOne({_id: req.params.id}, {$push: {todoGroup: data}});
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
};

const updateTodoGroup = async (req, res, next) => {
  try {
    await Task.updateOne(
      {_id: req.params.id, "todoGroup._id": req.params.todoGroup},
      {$set: {"todoGroup.$.title": req.body.title}}
    );
    res.status(200).json({ok: 1});
  } catch (e) {
    next(e);
  }
};

const newTodo = async (req, res, next) => {
  try {
    const todo = await (new Todo({text: req.body.text})).save();
    await Task.updateOne({_id: req.params.id, "todoGroup._id": req.params.todoGroup}, {$push: {"todoGroup.$.list": todo._id}});
    res.status(200).json(todo);
  } catch (e) {
    next(e);
  }
};

const deleteTodo = async (req, res, next) => {
  try {
    await Promise.all([
      Todo.deleteOne({_id: req.params.todo}),
      Task.updateOne({_id: req.params.id, "todoGroup.list._id": req.params.todo}, {$pull: {"todoGroup.list.$": req.params.todo}})
    ]);
    res.status(200).json({ok: 1});
  } catch (e) {
    next(e);
  }
};

const deleteTodoGroup = async (req, res, next) => {
  try {
    const todoGroup = (await Task.findOne({_id: req.params.id})).todoGroup.find(t => t._id == req.params.todoGroup);
    await Promise.all([
      ...todoGroup.list.map(t => Todo.deleteOne({_id: t})),
      Task.updateOne({_id: req.params.id}, {$pull: {todoGroup: {_id: req.params.todoGroup}}})
    ]);
    res.send({ok: 1});
  } catch (e) {
    next(e);
  }
};

const remove = async (req, res, next) => {
  try {
    const tasks = await Task.find({_id: {$in: req.body.tasks}});
    const todos = tasks.map(task => task.todoGroup?.map(group => group.list.map(t => t))).flat().flat();
    const comments = tasks.map(task => task.comments).flat();
    const attachments = tasks.map(task => task.attachments).flat();
    await Task.deleteMany({_id: {$in: req.body.tasks}});
    await Promise.all([
      Todo.deleteMany({_id: {$in: todos}}),
      Comment.deleteMany({_id: {$in: comments}}),
      Attachment.deleteMany({_id: {$in: attachments}}),
      Task.deleteMany({_id: {$in: tasks.map(t => t._id)}}),
      Project.updateOne({tasks: {$in: req.body.tasks}}, {$pull: {tasks: {$in: req.body.tasks}}})
    ]);
    res.status(200).json({ok: 1});
  } catch (e) {
    next(e);
  }
};

router.post("/", auth.required, create);
router.get("/:id", auth.required, get);
router.put("/:id", auth.required, update);
router.post("/:id/duplicate", auth.required, duplicate);
router.put("/update/multi", auth.required, updateMultiple);
router.put("/:id/file", [auth.required, upload.array('file')], uploadFiles);
router.put("/:id/todoGroup", auth.required, createTodoGroup);
router.put("/:id/todoGroup/:todoGroup", auth.required, updateTodoGroup);
router.put("/:id/newTodo/:todoGroup", auth.required, newTodo);
router.delete("/:id/todoGroup/:todoGroup", auth.required, deleteTodoGroup);
router.delete("/:id/todo/:todo", auth.required, deleteTodo);
router.delete("/:id/file/:file", auth.required, removeAttachment);
router.put("/delete/tasks", auth.required, remove);

module.exports = router;
