const Status = require("../models/Status");

exports.createStatus = async (req, res) => {
  const status = await Status.create({
    user: req.user.id,
    image: req.body.image
  });
  res.json(status);
};

exports.getStatus = async (req, res) => {
  const status = await Status.find();
  res.json(status);
};