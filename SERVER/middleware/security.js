const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');

// General rate limiting for all requests (more permissive for development)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased from 100 to 1000 requests per windowMs for development
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    console.log(`🚫 Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: 15 * 60
    });
  }
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    console.log(`🚫 Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Too many authentication attempts, please try again later.',
      retryAfter: 15 * 60
    });
  }
});

// File upload rate limiting
const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit each IP to 3 uploads per 5 minutes
  message: {
    error: 'Too many uploads',
    message: 'Too many uploads, please try again later.',
    retryAfter: 5 * 60
  },
  handler: (req, res) => {
    console.log(`🚫 Upload rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many uploads',
      message: 'Too many uploads, please try again later.',
      retryAfter: 5 * 60
    });
  }
});

// API rate limiting for data-heavy operations (more permissive)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Increased from 30 to 100 API calls per minute for development
  message: {
    error: 'API rate limit exceeded',
    message: 'Too many API requests, please slow down.',
    retryAfter: 60
  },
  handler: (req, res) => {
    console.log(`🚫 API rate limit exceeded for IP: ${req.ip}, URL: ${req.url}`);
    res.status(429).json({
      error: 'API rate limit exceeded',
      message: 'Too many API requests, please slow down.',
      retryAfter: 60
    });
  }
});

// Speed limiting for heavy operations (progressive delay)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 10, // Allow 10 requests per 15 minutes at full speed
  delayMs: () => 500, // Add 500ms delay per request after delayAfter (new API format)
  maxDelayMs: 5000, // Maximum delay of 5 seconds
  // onLimitReached is deprecated and removed
  validate: { delayMs: false } // Disable validation warning
});

// Security headers using helmet
const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    },
  },
  
  // Cross-origin policies
  crossOriginEmbedderPolicy: false, // May interfere with some functionality
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  
  // Remove X-Powered-By header
  hidePoweredBy: true,
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // Prevent MIME type sniffing
  noSniff: true,
  
  // Prevent page from being displayed in frame/iframe
  frameguard: { action: 'deny' },
  
  // XSS Protection
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: { policy: ['origin', 'same-origin'] },
  
  // Permissions Policy (formerly Feature Policy)
  permittedCrossDomainPolicies: false
});

// Create user-specific rate limiter
const createUserLimiter = (maxRequests = 200, windowMs = 15 * 60 * 1000) => {
  const userLimiters = new Map();
  
  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    
    if (!userLimiters.has(key)) {
      userLimiters.set(key, rateLimit({
        windowMs,
        max: maxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          console.log(`🚫 User rate limit exceeded for: ${key}`);
          res.status(429).json({
            error: 'Too many requests',
            message: 'You have exceeded your request limit. Please try again later.',
            retryAfter: Math.ceil(windowMs / 1000)
          });
        }
      }));
    }
    
    userLimiters.get(key)(req, res, next);
  };
};

// Brute force protection middleware
const bruteForceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Start blocking after 1000 requests
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`🛡️ Potential brute force attack detected from: ${req.ip}`);
    res.status(429).json({
      error: 'Suspicious activity detected',
      message: 'Your requests have been temporarily blocked due to suspicious activity.',
      retryAfter: 60
    });
  }
});

// Middleware to log security events
const securityLogger = (req, res, next) => {
  // Log sensitive operations
  const sensitiveOperations = ['DELETE', 'PUT', 'PATCH'];
  const sensitiveEndpoints = ['/upload', '/delete', '/admin', '/settings'];
  
  if (sensitiveOperations.includes(req.method) || 
      sensitiveEndpoints.some(endpoint => req.path.includes(endpoint))) {
    console.log('🔒 Security Event:', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      user: req.user?.id || 'anonymous',
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// IP whitelist middleware (for admin operations)
const createIPWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      console.log(`🚫 IP not whitelisted: ${clientIP}`);
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not authorized to access this resource.'
      });
    }
    
    next();
  };
};

module.exports = {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  apiLimiter,
  speedLimiter,
  securityHeaders,
  createUserLimiter,
  bruteForceLimiter,
  securityLogger,
  createIPWhitelist
};
