const mongoose = require("mongoose");

const statusSchema = new mongoose.Schema({
  user: String,
  image: String,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400
  }
});

module.exports = mongoose.model("Status", statusSchema);