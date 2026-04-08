const Message = require("../models/Message.model");

exports.getMessages = async (req, res) => {
  const msgs = await Message.find({
    $or: [
      { sender: req.user.id },
      { receiver: req.user.id }
    ]
  });
  res.json(msgs);
};