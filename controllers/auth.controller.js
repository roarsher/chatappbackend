 const User = require('../models/User.model');

// ─── Cookie options ───────────────────────────────────────────────────────────
// Cross-domain deployments (Render backend + Vercel frontend) REQUIRE:
//   SameSite=None + Secure=true
// SameSite=Strict or Lax will silently block the cookie on cross-origin requests.
const getCookieOptions = () => ({
  expires: new Date(
    Date.now() + parseInt(process.env.JWT_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000
  ),
  httpOnly: true,                                        // No JS access — XSS safe
  secure: true,                                          // HTTPS only (Render is always HTTPS)
  sameSite: process.env.NODE_ENV === 'production'
    ? 'none'    // Cross-domain: must be 'none' + secure=true
    : 'lax',    // Local dev (same host different port): 'lax' works fine
  path: '/',
});

// ─── Helper: Set JWT cookie and send response ──────────────────────────────────
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.generateJWT();

  res
    .status(statusCode)
    .cookie('token', token, getCookieOptions())
    .json({
      success: true,
      user: user.toSafeObject(),
      // Expose token in body so the frontend can store it in memory as fallback
      token,
    });
};

// ─── Register ──────────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email
          ? 'Email already registered.'
          : 'Username already taken.',
      });
    }

    const user = await User.create({ username, email, password });
    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
};

// ─── Login ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// ─── Logout ────────────────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: false,
      lastSeen: new Date(),
      socketId: null,
    });

    res
      .cookie('token', '', {
        ...getCookieOptions(),
        expires: new Date(0),   // Expire immediately
      })
      .status(200)
      .json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─── Get current user ──────────────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.status(200).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};