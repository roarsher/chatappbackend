 const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

// ─── Protect: Verify JWT from cookie or Authorization header ──────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Check HTTP-only cookie first (preferred)
    if (req.cookies?.token) {
      token = req.cookies.token;
    }
    // 2. Fallback: Authorization Bearer header
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Please log in.',
      });
    }

    // Verify token
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

    // Check user still exists
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists.',
      });
    }

    // Check if password changed after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        success: false,
        message: 'Password recently changed. Please log in again.',
      });
    }

    // Attach user to request
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

// ─── Socket Auth: Verify JWT for socket connections ───────────────────────────
const socketAuth = async (socket, next) => {
  try {
    // Extract token from cookie or handshake auth
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.cookie
        ?.split(';')
        .find((c) => c.trim().startsWith('token='))
        ?.split('=')[1];

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
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    // Attach user to socket
    socket.user = user.toSafeObject();
    next();
  } catch (err) {
    next(new Error('Authentication error: ' + err.message));
  }
};

module.exports = { protect, authorize, socketAuth };
