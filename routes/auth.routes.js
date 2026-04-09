 const express = require('express');
const router = express.Router();
const { register, login, logout, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateRegister, validateLogin } = require('../middleware/validate.middleware');

router.post('/register', validateRegister, register);
router.post('/login',    validateLogin,    login);
router.post('/logout',   protect,          logout);
router.get('/me',        protect,          getMe);

module.exports = router;