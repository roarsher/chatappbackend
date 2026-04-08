 const express = require('express');
const router = express.Router();
const { register, login, logout, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { registerValidators, loginValidators } = require('../middleware/validate.middleware');

router.post('/register', registerValidators, register);
router.post('/login', loginValidators, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;
