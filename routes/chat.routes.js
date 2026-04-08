 const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getConversations,
  deleteMessage,
  uploadMedia,
} = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');
const { messageValidators } = require('../middleware/validate.middleware');
const { handleMediaUpload } = require('../middleware/upload.middleware');

router.use(protect);

router.get('/conversations', getConversations);
router.get('/:userId', getMessages);
router.post('/send', messageValidators, sendMessage);
router.post('/upload', handleMediaUpload, uploadMedia);
router.delete('/:messageId', deleteMessage);

module.exports = router;
