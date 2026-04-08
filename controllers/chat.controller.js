 const Message = require('../models/Message.model');
const User = require('../models/User.model');
const path = require('path');
const fs = require('fs');

// ─── Upload media (image / video / file) ──────────────────────────────────────
exports.uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { receiverId } = req.body;
    if (!receiverId) {
      return res.status(400).json({ success: false, message: 'receiverId is required.' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      fs.unlinkSync(req.file.path); // Clean up orphaned file
      return res.status(404).json({ success: false, message: 'Receiver not found.' });
    }

    const mime = req.file.mimetype;
    let type = 'file';
    if (mime.startsWith('image/')) type = 'image';
    else if (mime.startsWith('video/')) type = 'video';

    const fileUrl = `/uploads/media/${req.file.filename}`;
    const conversationId = Message.getConversationId(req.user._id, receiverId);

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      content: req.file.originalname,
      type,
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: mime,
      conversationId,
    });

    await message.populate([
      { path: 'sender', select: 'username avatar' },
      { path: 'receiver', select: 'username avatar' },
    ]);

    // Emit real-time
    const io = req.app.get('io');
    if (receiver.socketId) {
      io.to(receiver.socketId).emit('newMessage', message);
    }

    res.status(201).json({ success: true, message });
  } catch (err) {
    next(err);
  }
};

// ─── Send a text message ───────────────────────────────────────────────────────
exports.sendMessage = async (req, res, next) => {
  try {
    const { content, receiverId } = req.body;
    const senderId = req.user._id;

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Receiver not found.' });
    }
    if (senderId.toString() === receiverId) {
      return res.status(400).json({ success: false, message: 'Cannot send message to yourself.' });
    }

    const conversationId = Message.getConversationId(senderId, receiverId);
    const message = await Message.create({ sender: senderId, receiver: receiverId, content, conversationId });

    await message.populate([
      { path: 'sender', select: 'username avatar' },
      { path: 'receiver', select: 'username avatar' },
    ]);

    const io = req.app.get('io');
    if (receiver.socketId) {
      io.to(receiver.socketId).emit('newMessage', message);
    }

    res.status(201).json({ success: true, message });
  } catch (err) {
    next(err);
  }
};

// ─── Get messages ──────────────────────────────────────────────────────────────
exports.getMessages = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const myId = req.user._id;
    const { page = 1, limit = 50 } = req.query;
    const conversationId = Message.getConversationId(myId, userId);

    const messages = await Message.find({ conversationId, isDeleted: false })
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Message.countDocuments({ conversationId, isDeleted: false });

    await Message.updateMany(
      { conversationId, receiver: myId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      messages: messages.reverse(),
      pagination: { current: parseInt(page), pages: Math.ceil(total / limit), total },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get conversations ─────────────────────────────────────────────────────────
exports.getConversations = async (req, res, next) => {
  try {
    const myId = req.user._id;
    const conversations = await Message.aggregate([
      { $match: { $or: [{ sender: myId }, { receiver: myId }], isDeleted: false } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: { $cond: [{ $and: [{ $eq: ['$receiver', myId] }, { $eq: ['$isRead', false] }] }, 1, 0] },
          },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
    ]);

    const populated = await Promise.all(
      conversations.map(async (conv) => {
        const otherId =
          conv.lastMessage.sender.toString() === myId.toString()
            ? conv.lastMessage.receiver
            : conv.lastMessage.sender;
        const otherUser = await User.findById(otherId).select('username avatar isOnline lastSeen');
        return { conversationId: conv._id, participant: otherUser, lastMessage: conv.lastMessage, unreadCount: conv.unreadCount };
      })
    );

    res.status(200).json({ success: true, conversations: populated });
  } catch (err) {
    next(err);
  }
};

// ─── Delete message ────────────────────────────────────────────────────────────
exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content = 'This message was deleted.';
    await message.save();
    res.status(200).json({ success: true, message: 'Message deleted.' });
  } catch (err) {
    next(err);
  }
};
