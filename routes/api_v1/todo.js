const router = require('express').Router();
const Todo = require('../../models/Todo');
const auth = require('../auth');
const {getNotNullFields} = require('../../utils');

const create = async (req, res, next) => {
  try {
    const {text, project} = req.body;
    const data = {text};
    if (project) data.project = project;
    else data.user = req.payload.id;
    const todo = new Todo(data);
    await todo.save();
    res.status(200).json(todo);
  } catch (e) {
    next(e);
  }
};

const getOfProject = async (req, res, next) => {
  try {
    const todo = await Todo.find({project: req.params.id});
    res.status(200).json(todo);
  } catch (e) {
    next(e);
  }
};

const getOfUser = async (req, res, next) => {
  try {
    const todo = await Todo.find({user: req.payload.id});
    res.status(200).json(todo);
  } catch (e) {
    next(e);
  }
};

const update = async (req, res, next) => {
  try {
    const {text, checked} = req.body;
    const todo = await Todo.findOneAndUpdate({_id: req.params.id}, {$set: getNotNullFields({text, checked})}, {new: true});
    res.status(200).json(todo);
  } catch (e) {
    next(e);
  }
};

const remove = async (req, res, next) => {
  try {
    await Todo.deleteOne({_id: req.params.id});
    res.status(200).json({ok: 1});
  } catch (e) {
    next(e);
  }
};

router.post("/", auth.required, create);
router.get("/project/:id", auth.required, getOfProject);
router.get("/user", auth.required, getOfUser);
router.put("/:id", auth.required, update);
router.delete("/:id", auth.required, remove);

module.exports = router;
