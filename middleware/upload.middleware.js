const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
['uploads/media', 'uploads/avatars'].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/media/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${req.user._id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED_IMAGE = /jpeg|jpg|png|gif|webp/;
const ALLOWED_VIDEO = /mp4|webm|ogg|mov|avi/;
const ALLOWED_FILE  = /pdf|doc|docx|txt|zip|rar/;

const mediaFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  const mime = file.mimetype;
  const isImage = ALLOWED_IMAGE.test(ext) && mime.startsWith('image/');
  const isVideo = ALLOWED_VIDEO.test(ext) && mime.startsWith('video/');
  const isFile  = ALLOWED_FILE.test(ext);
  if (isImage || isVideo || isFile) return cb(null, true);
  cb(new Error('Unsupported file type.'), false);
};

const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: mediaFilter,
}).single('file');

// Wrap multer to pass errors to Express error handler
const handleMediaUpload = (req, res, next) => {
  uploadMedia(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

module.exports = { handleMediaUpload };
