 const { body, validationResult } = require('express-validator');

// ─── Final middleware: collect validation errors and respond ──────────────────
// This must be used as a SEPARATE middleware argument after the body() chains,
// NOT mixed into the same array as them. Mixing causes "next is not a function"
// because express-validator treats every array item as a validator, not Express middleware.
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ─── Register: array of body() chains only (no validate here) ────────────────
const registerValidators = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, underscores'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase and a number'),
];

// ─── Login: array of body() chains only ──────────────────────────────────────
const loginValidators = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
];

// ─── Message: array of body() chains only ────────────────────────────────────
const messageValidators = [
  body('content')
    .trim()
    .notEmpty().withMessage('Message content is required')
    .isLength({ max: 2000 }).withMessage('Message cannot exceed 2000 characters'),
  body('receiverId')
    .notEmpty().withMessage('Receiver ID is required')
    .isMongoId().withMessage('Invalid receiver ID'),
];

module.exports = {
  registerValidators,
  loginValidators,
  messageValidators,
  validate,
};