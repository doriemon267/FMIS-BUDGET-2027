/**
 * Input sanitization for req.body - strips HTML/script tags from string values to prevent XSS.
 * Apply to mutation routes (POST, PUT, PATCH).
 */
const sanitizeHtml = require('sanitize-html');

const ALLOWED_TAGS = [];
const ALLOWED_ATTR = {};

function sanitizeValue(val) {
  if (val == null) return val;
  if (typeof val === 'string') {
    return sanitizeHtml(val, { allowedTags: ALLOWED_TAGS, allowedAttributes: ALLOWED_ATTR });
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (typeof val === 'object' && val.constructor === Object) {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = sanitizeValue(v);
    }
    return out;
  }
  return val;
}

module.exports = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
};
