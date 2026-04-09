 /**
 * Manual validation middleware — replaces express-validator entirely.
 * express-validator v7 changed its internal API in a way that breaks
 * when body() chains and plain middleware functions are mixed in route arrays.
 * This approach has zero external dependencies and zero version-sensitivity.
 */

// ─── Tiny helper ──────────────────────────────────────────────────────────────
const fail = (res, errors) =>
  res.status(400).json({ success: false, message: errors[0], errors });

// ─── Register ─────────────────────────────────────────────────────────────────
const validateRegister = (req, res, next) => {
  const { username, email, password } = req.body;
  const errors = [];

  if (!username || typeof username !== 'string' || username.trim().length < 3)
    errors.push('Username must be at least 3 characters.');
  else if (username.trim().length > 20)
    errors.push('Username cannot exceed 20 characters.');
  else if (!/^[a-zA-Z0-9_]+$/.test(username.trim()))
    errors.push('Username can only contain letters, numbers, and underscores.');

  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim()))
    errors.push('Please enter a valid email address.');

  if (!password || typeof password !== 'string' || password.length < 8)
    errors.push('Password must be at least 8 characters.');
  else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password))
    errors.push('Password must contain at least one uppercase letter, one lowercase letter, and one number.');

  if (errors.length) return fail(res, errors);

  // Sanitise in place so controller always gets clean values
  req.body.username = username.trim();
  req.body.email    = email.trim().toLowerCase();

  next();
};

// ─── Login ────────────────────────────────────────────────────────────────────
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim()))
    errors.push('Please enter a valid email address.');
  if (!password || typeof password !== 'string' || !password.length)
    errors.push('Password is required.');

  if (errors.length) return fail(res, errors);

  req.body.email = email.trim().toLowerCase();
  next();
};

// ─── Message ──────────────────────────────────────────────────────────────────
const validateMessage = (req, res, next) => {
  const { content, receiverId } = req.body;
  const errors = [];

  if (!content || typeof content !== 'string' || !content.trim().length)
    errors.push('Message content is required.');
  else if (content.trim().length > 2000)
    errors.push('Message cannot exceed 2000 characters.');

  if (!receiverId || typeof receiverId !== 'string' || !/^[a-f\d]{24}$/i.test(receiverId))
    errors.push('A valid receiver ID is required.');

  if (errors.length) return fail(res, errors);

  req.body.content = content.trim();
  next();
};

module.exports = { validateRegister, validateLogin, validateMessage };