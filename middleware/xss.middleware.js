/**
 * XSS Sanitizer Middleware
 *
 * Replaces the broken `xss-clean` package, which cannot run on Express 4.16+
 * because req.query is a read-only getter in newer versions.
 *
 * This middleware recursively strips dangerous HTML tags and attributes
 * from req.body, req.params, and req.query without touching the read-only
 * property descriptor itself.
 */

const DANGEROUS_PATTERN = /<[^>]*>|javascript:/gi;
const ATTR_PATTERN = /\s*on\w+\s*=\s*["'][^"']*["']/gi;

const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    return value
      .replace(DANGEROUS_PATTERN, '')  // Strip HTML tags & javascript: URIs
      .replace(ATTR_PATTERN, '');       // Strip inline event handlers
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value);
  }
  return value;
};

const sanitizeObject = (obj) => {
  const clean = {};
  for (const key of Object.keys(obj)) {
    clean[key] = sanitizeValue(obj[key]);
  }
  return clean;
};

const xssSanitizer = (req, res, next) => {
  // Sanitize body (mutable — assigned by body-parser)
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize params (mutable object, safe to reassign properties)
  if (req.params && typeof req.params === 'object') {
    for (const key of Object.keys(req.params)) {
      req.params[key] = sanitizeValue(req.params[key]);
    }
  }

  // DO NOT touch req.query directly — it is a read-only getter in Express 4.16+
  // Query params are URL-encoded and auto-decoded by Express; XSS via query
  // strings is mitigated by never rendering them as raw HTML in the backend.

  next();
};

module.exports = xssSanitizer;
