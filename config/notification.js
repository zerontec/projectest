const OneSignal = require('onesignal-node');
const {ONESIGNAL_APP, ONESIGNAL_KEY} = require('./index');

const client = new OneSignal.Client(ONESIGNAL_APP, ONESIGNAL_KEY);

async function sendNotification(msg, recipients, data, mutedBy) {
  try {
    const notification = {
      contents: {'en': msg},
      include_external_user_ids: recipients.filter(r => !mutedBy?.includes(r)),
      data
    };
    const response = await client.createNotification(notification);
    return response;
  } catch (e) {}
}

module.exports = {sendNotification};
