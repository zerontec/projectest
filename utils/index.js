const _ = require('lodash');

exports.getNotNullFields = (data) => {
  const out = {};
  _(data).forEach((value, key) => {
    if (!_.isEmpty(value) || _.isBoolean(value) || _.isNumber(value)) {
      out[key] = value;
    }
  });
  return out;
};

exports.getFileName = filename => {
  if (filename.length > 20)
    return filename.substring(0, 20) + '.' + filename.split('.').pop();
  else
    return filename;
};
