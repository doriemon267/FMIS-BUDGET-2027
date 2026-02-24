/**
 * CSRF verification for API state-changing requests (double-submit cookie pattern).
 * Enable with ENABLE_CSRF_VERIFY=true.
 * Requires csrf-token endpoint to set XSRF-TOKEN cookie; client sends X-CSRF-Token header.
 */
const EXEMPT_PATHS = ['/login', '/csrf-token', '/health', '/get-user', '/logout'];

function isStateChanging(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method).toUpperCase());
}

module.exports = (req, res, next) => {
  if (process.env.ENABLE_CSRF_VERIFY !== 'true') return next();

  if (!isStateChanging(req.method)) return next();

  const path = (req.path || '').replace(/^\/api\/?/, '/') || '/';
  const isExempt = EXEMPT_PATHS.some((p) => path === p || path.startsWith(p + '/'));
  if (isExempt) return next();

  const headerToken = (req.headers['x-csrf-token'] || req.headers['X-CSRF-Token'] || '').trim();
  const cookieToken = (req.cookies?.['XSRF-TOKEN'] || req.cookies?.['XSRF_TOKEN'] || req.cookies?.xsrf_token || '').trim();

  if (!headerToken || !cookieToken) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'Request requires valid X-CSRF-Token header.',
    });
  }

  if (headerToken !== cookieToken) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token validation failed.',
    });
  }

  next();
};
