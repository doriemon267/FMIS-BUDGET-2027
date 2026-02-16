/**
 * CSRF Protection Middleware
 * 
 * Note: csurf is already installed in package.json
 */

let csrf;
try {
  csrf = require('csurf');
} catch (e) {
  console.warn('[CSRF] csurf not installed. Run: npm install csurf');
  // Fallback: return no-op middleware
  const noOpProtection = (req, res, next) => next();
  const noOpGetToken = (req, res, next) => {
    res.locals.csrfToken = 'not-configured';
    next();
  };
  module.exports = {
    csrfProtection: noOpProtection,
    getCsrfToken: noOpGetToken,
    skipCsrfForRoutes: () => noOpProtection,
  };
  return;
}

// CSRF protection configuration
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
    sameSite: 'strict',
  },
});

/**
 * Get CSRF token (for use in frontend)
 */
const getCsrfToken = (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
};

/**
 * Skip CSRF for certain routes (e.g., webhooks, public APIs)
 */
const skipCsrfForRoutes = (skipRoutes = []) => {
  return (req, res, next) => {
    const shouldSkip = skipRoutes.some((route) => {
      if (typeof route === 'string') {
        return req.path.startsWith(route);
      }
      if (route instanceof RegExp) {
        return route.test(req.path);
      }
      return false;
    });

    if (shouldSkip) {
      return next();
    }

    return csrfProtection(req, res, next);
  };
};

module.exports = {
  csrfProtection,
  getCsrfToken,
  skipCsrfForRoutes,
};
