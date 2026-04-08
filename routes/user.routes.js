 const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateProfile,
  adminGetAllUsers,
  adminDeleteUser,
} = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');

// ─── Multer config for avatar upload ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.user._id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const isValid = allowed.test(path.extname(file.originalname).toLowerCase()) &&
                    allowed.test(file.mimetype);
    cb(isValid ? null : new Error('Only image files are allowed.'), isValid);
  },
});

router.use(protect);

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/profile', upload.single('avatar'), updateProfile);

// Admin-only routes
router.get('/admin/all', authorize('admin'), adminGetAllUsers);
router.delete('/admin/:id', authorize('admin'), adminDeleteUser);

module.exports = router;
