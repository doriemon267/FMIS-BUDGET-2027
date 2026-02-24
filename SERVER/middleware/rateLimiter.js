/**
 * Rate limiting middleware for API endpoints
 * 
 * Note: Install express-rate-limit if not already installed:
 * npm install express-rate-limit
 */

let rateLimit;
let ipKeyGenerator;
try {
  const erl = require('express-rate-limit');
  rateLimit = erl.rateLimit || erl;
  ipKeyGenerator = erl.ipKeyGenerator;
} catch (e) {
  console.warn('[RateLimiter] express-rate-limit not installed. Run: npm install express-rate-limit');
  // Fallback: return no-op middleware
  const noOpLimiter = (req, res, next) => next();
  module.exports = {
    apiLimiter: noOpLimiter,
    authLimiter: noOpLimiter,
    uploadLimiter: noOpLimiter,
    proposalLimiter: noOpLimiter,
  };
  return;
}

// In development or when DISABLE_RATE_LIMIT=true, use a much higher limit to avoid "Too many requests" on localhost
const isDev = process.env.NODE_ENV !== 'production' || process.env.DISABLE_RATE_LIMIT === 'true';
// Production: 500 per 15 min — normal use (many API calls per page + notifications polling) can reach 100+ with just a few pages; 100 was too strict
const apiMax = isDev ? 10000 : (Number(process.env.RATE_LIMIT_API_MAX) || 500);

// Strip port from IP (fixes ERR_ERL_INVALID_IP_ADDRESS when req.ip includes port, e.g. ::1:52341).
// Use ipKeyGenerator (v8+) so IPv6 is normalized and ERR_ERL_KEY_GEN_IPV6 is avoided.
const keyGenerator = (req) => {
  const raw = req.ip || req.socket?.remoteAddress || 'unknown';
  const ip = raw.replace(/:\d+[^:]*$/, '') || raw;
  if (typeof ipKeyGenerator === 'function') {
    return ipKeyGenerator(ip);
  }
  return ip;
};

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: apiMax, // Limit each IP per windowMs (500 in prod by default, 10000 in dev; override with RATE_LIMIT_API_MAX)
  keyGenerator,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for authentication endpoints (failed attempts only)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : (Number(process.env.RATE_LIMIT_AUTH_MAX) || 5),
  keyGenerator,
  message: {
    error: 'Too many login attempts, please try again after 15 minutes.',
  },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for file uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  keyGenerator,
  message: {
    error: 'Too many file uploads, please try again later.',
  },
});

// Rate limiter for proposal submissions
const proposalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 proposal submissions per hour
  keyGenerator,
  message: {
    error: 'Too many proposal submissions, please try again later.',
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  proposalLimiter,
};
