const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const { getMessages } = require("../controllers/messageController");

router.get("/", auth, getMessages);

module.exports = router;