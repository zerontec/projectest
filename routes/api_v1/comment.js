const router = require('express').Router();
const Task = require('../../models/Task');
const Comment = require('../../models/Comment');
const Attachment = require('../../models/Attachment');
const auth = require('../auth');
const {getNotNullFields, getFileName} = require('../../utils');
const {upload, getImageName} = require('../../config/storage');
const s3 = require('../../config/s3');

const create = async (req, res, next) => {
  try {
    const {content, task} = req.body;
    const comment = new Comment({content, user: req.payload.id, createdAt: new Date()});
    await comment.save();
    await Task.updateOne({_id: task}, {$push: {comments: comment._id}});
    res.status(200).json(comment);
  } catch (e) {
    next(e);
  }
};

const update = async (req, res, next) => {
  try {
    const {content} = req.body;
    const comment = await Comment.findOneAndUpdate(
      {_id: req.params.id},
      {$set: getNotNullFields({content})},
      {new: true}
    );
    res.status(200).json(comment);
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
    await Comment.updateOne(
      {_id: req.params.id},
      {$push: {attachments: savedAttachments.map(a => a._id)}},
    );
    res.status(200).json({comment: req.params.id, uploadedAttachments: savedAttachments});
  } catch (e) {
    next(e);
  }
};

const removeAttachment = async (req, res, next) => {
  try {
    const file = await Attachment.findOne({_id: req.params.file}, {src: 1});
    await Promise.all([
      Comment.updateOne({_id: req.params.id}, {$pull: {attachments: req.params.file}}),
      Attachment.deleteOne({_id: req.params.file}),
      s3.remove(file.src)
    ]);
    res.send({deletedFile: file._id});
  } catch (e) {
    next(e);
  }
};

const remove = async (req, res, next) => {
  try {
    await Comment.deleteOne({_id: req.params.id});
    await Task.updateOne({comments: {$in: req.params.id}}, {$pull: {comments: req.params.id}});
    res.status(200).json({ok: 1});
  } catch (e) {
    next(e);
  }
};

router.post("/", auth.required, create);
router.put("/:id", auth.required, update);
router.put("/:id/file", [auth.required, upload.array('file')], uploadFiles);
router.delete("/:id/file/:file", auth.required, removeAttachment);
router.delete("/:id", auth.required, remove);

module.exports = router;
