/**
 * Log Redaction Utility - Masks sensitive information from logs
 */

const PATTERNS = {
  // Email addresses: user@domain.com -> u***@d***.com
  email: /[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Message IDs from email: <668a128a-4118-211b-dd99-179acc4db1b9@gmail.com> -> [EMAIL_MSG_ID]
  messageId: /<[a-f0-9\-]+@[a-zA-Z0-9.-]+>/gi,
  // MongoDB ObjectIds: new ObjectId('691bbe9860af98c1969e2c16') -> [OBJECT_ID]
  objectId: /ObjectId\('[a-f0-9]{24}'\)/g,
  // Phone numbers: +63 123 456 7890 or 09171234567
  phone: /(\+63|0)[0-9\s\-()]{9,}/g,
};

/**
 * Redact sensitive information from a string
 * @param {string} str - String to redact
 * @returns {string} - Redacted string
 */
function redactString(str) {
  if (typeof str !== 'string') return str;

  let redacted = str;

  // Redact emails
  redacted = redacted.replace(PATTERNS.email, (match) => {
    const parts = match.split('@');
    const localPart = parts[0];
    const domainPart = parts[1];
    const displayLocal = localPart.charAt(0) + '*'.repeat(Math.max(localPart.length - 2, 1)) + localPart.charAt(localPart.length - 1);
    const displayDomain = domainPart.charAt(0) + '*'.repeat(Math.max(domainPart.length - 2, 1)) + domainPart.charAt(domainPart.length - 1);
    return `${displayLocal}@${displayDomain}`;
  });

  // Redact message IDs
  redacted = redacted.replace(PATTERNS.messageId, '[EMAIL_MSG_ID]');

  // Redact ObjectIds
  redacted = redacted.replace(PATTERNS.objectId, '[OBJECT_ID]');

  // Redact phone numbers
  redacted = redacted.replace(PATTERNS.phone, '[PHONE]');

  return redacted;
}

/**
 * Recursively redact sensitive data from objects
 * @param {*} obj - Object to redact
 * @returns {*} - Redacted object
 */
function redactObject(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return redactString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item));
  }

  if (typeof obj === 'object') {
    const redacted = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        redacted[key] = redactObject(obj[key]);
      }
    }
    return redacted;
  }

  return obj;
}

// Store original console methods to avoid recursion
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

/**
 * Create a redacting console replacement
 */
const createRedactingLogger = () => {
  return {
    log(...args) {
      const redactedArgs = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return redactObject(arg);
          } catch (e) {
            return arg;
          }
        }
        return redactString(String(arg));
      });
      originalConsole.log(...redactedArgs);
    },

    error(...args) {
      const redactedArgs = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return redactObject(arg);
          } catch (e) {
            return arg;
          }
        }
        return redactString(String(arg));
      });
      originalConsole.error(...redactedArgs);
    },

    warn(...args) {
      const redactedArgs = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return redactObject(arg);
          } catch (e) {
            return arg;
          }
        }
        return redactString(String(arg));
      });
      originalConsole.warn(...redactedArgs);
    },

    info(...args) {
      const redactedArgs = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return redactObject(arg);
          } catch (e) {
            return arg;
          }
        }
        return redactString(String(arg));
      });
      originalConsole.info?.(...redactedArgs);
    },

    debug(...args) {
      const redactedArgs = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return redactObject(arg);
          } catch (e) {
            return arg;
          }
        }
        return redactString(String(arg));
      });
      originalConsole.debug?.(...redactedArgs);
    }
  };
};

module.exports = {
  redactString,
  redactObject,
  createRedactingLogger,
  logger: createRedactingLogger()
};
