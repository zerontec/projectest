const router = require('express').Router();
const Note = require('../../models/Note');
const auth = require('../auth');

const create = async (req, res, next) => {
  try {
    const {text, project} = req.body;
    const data = {text};
    if (project) data.project = project;
    else data.user = req.payload.id;
    const note = new Note(data);
    await note.save();
    res.status(200).json(note);
  } catch (e) {
    next(e);
  }
};

const getOfProject = async (req, res, next) => {
  try {
    const note = await Note.find({project: req.params.id});
    res.status(200).json(note);
  } catch (e) {
    next(e);
  }
};

const getOfUser = async (req, res, next) => {
  try {
    const note = await Note.find({user: req.payload.id});
    res.status(200).json(note);
  } catch (e) {
    next(e);
  }
};

const update = async (req, res, next) => {
  try {
    const {text} = req.body;
    const data = await Note.findOneAndUpdate({_id: req.params.id}, {$set: {text}}, {new: true});
    res.json(data);
  } catch (e) {
    next(e);
  }
};

const remove = async (req, res, next) => {
  try {
    await Note.deleteOne({_id: req.params.id});
    res.json({ok: 1});
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
