/**
 * Centralized logging utility
 * Replaces console.log/error/warn with proper logging
 */

const isDevelopment = import.meta.env.DEV || process.env.NODE_ENV === 'development';

class Logger {
  /**
   * Log info messages (only in development)
   */
  info(message, ...args) {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  /**
   * Log warnings
   */
  warn(message, ...args) {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, ...args);
    }
    // In production, you could send to error tracking service
  }

  /**
   * Log errors
   */
  error(message, error, ...args) {
    console.error(`[ERROR] ${message}`, error, ...args);
    // In production, send to error tracking service (e.g., Sentry)
    // if (window.Sentry) {
    //   window.Sentry.captureException(error);
    // }
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message, ...args) {
    if (isDevelopment) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Log API calls
   */
  api(method, url, data, response) {
    if (isDevelopment) {
      console.log(`[API] ${method} ${url}`, { data, response });
    }
  }
}

export default new Logger();
