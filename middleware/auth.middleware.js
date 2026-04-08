 const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

// ─── Protect: Verify JWT ───────────────────────────────────────────────────────
// Token priority: 1) HTTP-only cookie  2) Authorization Bearer header
// The Bearer header fallback is needed when cross-site cookies are blocked
// (e.g. some browsers in strict third-party cookie mode).
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.cookies?.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Please log in.',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please log in again.',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }

    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    if (user.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        success: false,
        message: 'Password recently changed. Please log in again.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

// ─── Role-Based Authorization ──────────────────────────────────────────────────
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this resource.`,
      });
    }
    next();
  };
};

// ─── Socket Auth ───────────────────────────────────────────────────────────────
const socketAuth = async (socket, next) => {
  try {
    // Try cookie first, then handshake auth token
    let token =
      socket.handshake.headers?.cookie
        ?.split(';')
        .find((c) => c.trim().startsWith('token='))
        ?.split('=')[1]?.trim();

    if (!token) {
      token = socket.handshake.auth?.token;
    }

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }

    const user = await User.findById(decoded.id);
    if (!user) return next(new Error('Authentication error: User not found'));

    socket.user = user.toSafeObject();
    next();
  } catch (err) {
    next(new Error('Authentication error: ' + err.message));
  }
};

module.exports = { protect, authorize, socketAuth };