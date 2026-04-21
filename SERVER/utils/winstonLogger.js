const winston = require("winston");

const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "apikey",
  "authorization",
  "cookie",
  "jwt",
  "email",
  "mobile",
  "phone",
  "contact",
  "ssn",
  "tin",
  "address",
  "firstname",
  "lastname",
  "middlename",
  "fullname",
  "username",
  "name",
];

const PATTERNS = {
  email: /[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+63|0)[0-9\s\-()]{9,}/g,
  objectId: /\b[a-f0-9]{24}\b/gi,
};

function redactString(value) {
  if (typeof value !== "string") return value;

  return value
    .replace(PATTERNS.email, "[REDACTED_EMAIL]")
    .replace(PATTERNS.phone, "[REDACTED_PHONE]")
    .replace(PATTERNS.objectId, "[REDACTED_ID]");
}

function shouldRedactKey(key) {
  const normalized = String(key || "").toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive));
}

function redact(value) {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (typeof value === "object") {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = shouldRedactKey(k) ? "[REDACTED]" : redact(v);
    }
    return result;
  }
  return value;
}

const redactionFormat = winston.format((info) => {
  const cloned = { ...info };
  if (typeof cloned.message === "string") {
    cloned.message = redactString(cloned.message);
  }
  for (const key of Object.keys(cloned)) {
    if (["level", "message", "timestamp"].includes(key)) continue;
    cloned[key] = redact(cloned[key]);
  }
  return cloned;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.DEBUG_MODE === "true" ? "debug" : "info"),
  defaultMeta: { service: "fmis-budget-server" },
  format: winston.format.combine(
    winston.format.timestamp(),
    redactionFormat(),
    process.env.STRUCTURED_LOGGING === "true"
      ? winston.format.json()
      : winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
          return `[${timestamp}] [${level.toUpperCase()}] ${message}${suffix}`;
        })
  ),
  transports: [new winston.transports.Console()],
});

function normalizeArgs(args) {
  if (!args || args.length === 0) return { message: "", meta: undefined };

  if (typeof args[0] === "string") {
    return {
      message: args[0],
      meta: args.length > 1 ? { data: args.slice(1) } : undefined,
    };
  }

  return { message: "log", meta: { data: args } };
}

function wireConsoleToWinston() {
  const debugMode = process.env.DEBUG_MODE === "true";

  console.log = (...args) => {
    if (!debugMode) return;
    const { message, meta } = normalizeArgs(args);
    logger.info(message, meta);
  };

  console.info = (...args) => {
    if (!debugMode) return;
    const { message, meta } = normalizeArgs(args);
    logger.info(message, meta);
  };

  console.debug = (...args) => {
    if (!debugMode) return;
    const { message, meta } = normalizeArgs(args);
    logger.debug(message, meta);
  };

  console.warn = (...args) => {
    const { message, meta } = normalizeArgs(args);
    logger.warn(message, meta);
  };

  console.error = (...args) => {
    const { message, meta } = normalizeArgs(args);
    logger.error(message, meta);
  };
}

module.exports = {
  logger,
  redact,
  redactString,
  wireConsoleToWinston,
};
