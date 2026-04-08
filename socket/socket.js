 const { socketAuth } = require('../middleware/auth.middleware');
const User = require('../models/User.model');
const Message = require('../models/Message.model');

const onlineUsers = new Map(); // userId -> socketId
const activeCalls = new Map(); // callId -> { caller, callee, type, startedAt }

const initSocket = (io) => {
  io.use(socketAuth);

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`✅ Socket connected: ${socket.user.username} [${socket.id}]`);

    onlineUsers.set(userId, socket.id);
    await User.findByIdAndUpdate(userId, { isOnline: true, socketId: socket.id, lastSeen: new Date() });

    socket.broadcast.emit('userOnline', { userId, username: socket.user.username });
    socket.emit('onlineUsers', Array.from(onlineUsers.keys()));

    // ─── Text Message ─────────────────────────────────────────────────────────
    socket.on('sendMessage', async (data, callback) => {
      try {
        const { receiverId, content } = data;
        if (!receiverId || !content?.trim()) return callback?.({ success: false, error: 'Invalid data.' });
        if (content.length > 2000) return callback?.({ success: false, error: 'Message too long.' });

        const receiver = await User.findById(receiverId);
        if (!receiver) return callback?.({ success: false, error: 'Receiver not found.' });

        const conversationId = Message.getConversationId(userId, receiverId);
        const message = await Message.create({ sender: userId, receiver: receiverId, content: content.trim(), conversationId });
        await message.populate([{ path: 'sender', select: 'username avatar' }, { path: 'receiver', select: 'username avatar' }]);

        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) io.to(receiverSocketId).emit('newMessage', message);
        socket.emit('messageSent', message);
        callback?.({ success: true, message });
      } catch (err) {
        console.error('sendMessage error:', err);
        callback?.({ success: false, error: 'Failed to send message.' });
      }
    });

    // ─── Typing ───────────────────────────────────────────────────────────────
    socket.on('typing', ({ receiverId, isTyping }) => {
      const sid = onlineUsers.get(receiverId);
      if (sid) io.to(sid).emit('userTyping', { userId, username: socket.user.username, isTyping });
    });

    // ─── Mark Read ────────────────────────────────────────────────────────────
    socket.on('markRead', async ({ senderId }) => {
      try {
        const conversationId = Message.getConversationId(userId, senderId);
        await Message.updateMany({ conversationId, receiver: userId, isRead: false }, { isRead: true, readAt: new Date() });
        const senderSocketId = onlineUsers.get(senderId);
        if (senderSocketId) io.to(senderSocketId).emit('messagesRead', { by: userId });
      } catch (err) { console.error('markRead error:', err); }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    //  WEBRTC CALL SIGNALING
    // ═══════════════════════════════════════════════════════════════════════════

    // ─── Initiate call ────────────────────────────────────────────────────────
    socket.on('callUser', ({ receiverId, callType, offer }) => {
      const receiverSocketId = onlineUsers.get(receiverId);
      if (!receiverSocketId) {
        return socket.emit('callFailed', { reason: 'User is offline.' });
      }

      const callId = `${userId}_${receiverId}_${Date.now()}`;
      activeCalls.set(callId, {
        callerId: userId,
        callerName: socket.user.username,
        calleeId: receiverId,
        type: callType, // 'audio' | 'video'
        startedAt: new Date(),
      });

      io.to(receiverSocketId).emit('incomingCall', {
        callId,
        callerId: userId,
        callerName: socket.user.username,
        callType,
        offer,
      });

      // Store callId on socket for cleanup on disconnect
      socket.currentCallId = callId;
    });

    // ─── Accept call (send answer back to caller) ─────────────────────────────
    socket.on('acceptCall', ({ callId, answer }) => {
      const call = activeCalls.get(callId);
      if (!call) return socket.emit('callFailed', { reason: 'Call not found.' });

      const callerSocketId = onlineUsers.get(call.callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit('callAccepted', { callId, answer });
      }
      socket.currentCallId = callId;
    });

    // ─── ICE Candidate exchange ───────────────────────────────────────────────
    socket.on('iceCandidate', ({ callId, candidate, targetUserId }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('iceCandidate', { callId, candidate });
      }
    });

    // ─── Reject call ──────────────────────────────────────────────────────────
    socket.on('rejectCall', ({ callId }) => {
      const call = activeCalls.get(callId);
      if (!call) return;

      const callerSocketId = onlineUsers.get(call.callerId);
      if (callerSocketId) io.to(callerSocketId).emit('callRejected', { callId });
      activeCalls.delete(callId);
    });

    // ─── End call ─────────────────────────────────────────────────────────────
    socket.on('endCall', ({ callId, targetUserId }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) io.to(targetSocketId).emit('callEnded', { callId });
      activeCalls.delete(callId);
      socket.currentCallId = null;
    });

    // ─── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`❌ Socket disconnected: ${socket.user.username}`);

      // Cancel any active call
      if (socket.currentCallId) {
        const call = activeCalls.get(socket.currentCallId);
        if (call) {
          const otherId = call.callerId === userId ? call.calleeId : call.callerId;
          const otherSocketId = onlineUsers.get(otherId);
          if (otherSocketId) io.to(otherSocketId).emit('callEnded', { callId: socket.currentCallId, reason: 'User disconnected.' });
          activeCalls.delete(socket.currentCallId);
        }
      }

      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { isOnline: false, socketId: null, lastSeen: new Date() });
      io.emit('userOffline', { userId, username: socket.user.username });
    });

    socket.on('error', (err) => console.error(`Socket error for ${socket.user.username}:`, err.message));
  });
};

module.exports = { initSocket, onlineUsers };
