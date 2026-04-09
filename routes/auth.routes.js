 const express = require('express');
const router = express.Router();
const { register, login, logout, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { registerValidators, loginValidators, validate } = require('../middleware/validate.middleware');

// validate is passed as a SEPARATE argument after the validators array
router.post('/register', registerValidators, validate, register);
router.post('/login',    loginValidators,    validate, login);
router.post('/logout',   protect, logout);
router.get('/me',        protect, getMe);

module.exports = router;