/**
 * Structured JSON logger for server-side logging
 * Set STRUCTURED_LOGGING=true to output JSON for log aggregation (e.g. ELK, Datadog)
 */

const isStructured = process.env.STRUCTURED_LOGGING === 'true';

function formatEntry(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message: String(message),
    ...meta,
  };
  return isStructured ? JSON.stringify(entry) : `[${entry.timestamp}] [${level}] ${message}${Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''}`;
}

module.exports = {
  info(message, meta) {
    console.log(formatEntry('INFO', message, meta));
  },
  warn(message, meta) {
    console.warn(formatEntry('WARN', message, meta));
  },
  error(message, meta) {
    console.error(formatEntry('ERROR', message, meta));
  },
  debug(message, meta) {
    if (process.env.DEBUG_MODE === 'true') {
      console.debug(formatEntry('DEBUG', message, meta));
    }
  },
  /** Request log with correlation support */
  request(req, meta = {}) {
    const { method, path, ip } = req;
    this.info(`${method} ${path}`, { ip, ...meta });
  },
};
