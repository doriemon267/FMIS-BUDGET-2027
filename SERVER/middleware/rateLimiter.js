/**
 * Rate limiting middleware for API endpoints
 * 
 * Note: Install express-rate-limit if not already installed:
 * npm install express-rate-limit
 */

let rateLimit;
try {
  rateLimit = require('express-rate-limit');
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

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    error: 'Too many login attempts, please try again after 15 minutes.',
  },
  skipSuccessfulRequests: true,
});

// Rate limiter for file uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: {
    error: 'Too many file uploads, please try again later.',
  },
});

// Rate limiter for proposal submissions
const proposalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 proposal submissions per hour
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
