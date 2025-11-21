/**
 * Debug Logger - Conditional logging based on DEBUG_MODE env variable
 * Usage: const { debug, log, error } = require('./utils/debugLogger');
 * 
 * Set DEBUG_MODE=true in .env to enable verbose logging
 * Set DEBUG_MODE=false or leave empty to disable verbose logs
 */

const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

const createLogger = () => {
  return {
    // Critical logs - always shown
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    
    // Debug logs - shown only if DEBUG_MODE=true
    debug: (...args) => {
      if (DEBUG_MODE) console.log(...args);
    },
    
    // Info logs - shown only if DEBUG_MODE=true
    log: (...args) => {
      if (DEBUG_MODE) console.log(...args);
    },
    
    // Performance logs - always shown
    perf: (...args) => console.log(...args),
    
    // Conditional logging
    debugIf: (condition, ...args) => {
      if (DEBUG_MODE && condition) console.log(...args);
    }
  };
};

module.exports = createLogger();
