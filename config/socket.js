const { Server } = require("socket.io");

module.exports = function (server) {
  const io = new Server(server);
  io.on('connection', (socket) => {
    console.log('a user connected');

    const conversationId = socket.handshake.query.conversationId;
    const userId = socket.handshake.query.userId;
    if (conversationId) socket.join(conversationId);
    if (userId) socket.join(userId);

    socket.on('chat', messageData => {
      socket.broadcast.to(conversationId).emit('chat', messageData);
      messageData.message.recipientIds.forEach(r => io.to(r).emit('refreshConversation', messageData.message));
    });

    socket.on('createChat', data => {
      const recipients = data.users.filter(x => x._id !== userId).map(u => u._id);
      recipients.forEach(r => io.to(r).emit('newChat', data));
    });

    socket.on('disconnect', () => {
      console.log('a user disconnected');
    });
  });
};
