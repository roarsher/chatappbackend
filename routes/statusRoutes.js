const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const { createStatus, getStatus } = require("../controllers/statusController");

router.post("/", auth, createStatus);
router.get("/", auth, getStatus);

module.exports = router;