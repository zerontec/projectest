const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");
const {AWS_ACCESS_KEY, AWS_REGION, AWS_SECRET_KEY, BUCKET} = require('./index');

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_KEY,
  region: AWS_REGION
});

const s3 = new AWS.S3();
const upload = (file, folder, name) =>
  new Promise(function(resolve, reject) {
    const filePath = __dirname + "/../public/" + file.filename;
      const params = {
        Bucket: BUCKET,
        Body: fs.createReadStream(filePath),
        Key: folder + "/" + name || path.basename(filePath),
        ContentType: file.mimetype
      };
      s3.upload(params, function(err, data) {
        if (err) {
          reject(err); fs.unlink(filePath, ()=>{})
        }
        if (data) {
          fs.unlink(filePath, err => reject(err));
          resolve(data);
        }
      });
  });

const remove = filePath =>
  new Promise((resolve, reject) => {
    const params = {
      Bucket: BUCKET,
      Key: filePath
    };
    s3.deleteObject(params, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });

module.exports = { upload, remove };
