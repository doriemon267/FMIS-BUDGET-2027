const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');

let UserModel = null;
try {
  UserModel = require('../models/User');
} catch (error) {
  // Optional dependency - ignore if unavailable
  UserModel = null;
}

const NAME_HEADER_KEYS = [
  'x-dev-user-name',
  'x-user-name',
  'x-user-full-name',
  'x-forwarded-user',
  'x-forwarded-user-name',
  'x-real-user',
  'x-display-name',
  'x-authenticated-user',
  'x-remote-user'
];

const IP_HEADER_KEYS = [
  'x-client-ip',
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'fastly-client-ip',
  'true-client-ip',
  'x-cluster-client-ip',
  'x-forwarded',
  'forwarded-for',
  'forwarded'
];

const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes
const MAX_CACHE_SIZE = 500;
const identityCache = new Map();

const pruneCacheIfNeeded = () => {
  if (identityCache.size < MAX_CACHE_SIZE) return;
  const iterator = identityCache.keys();
  const oldestKey = iterator.next().value;
  if (oldestKey) {
    identityCache.delete(oldestKey);
  }
};

const setCache = (key, value) => {
  pruneCacheIfNeeded();
  identityCache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
};

const getCache = (key) => {
  const entry = identityCache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    identityCache.delete(key);
    return null;
  }
  return entry.value;
};

const sanitizeString = (value) => {
  if (value == null) return null;
  const str = String(value).replace(/\s+/g, ' ').trim();
  return str || null;
};

const isMeaningfulName = (value) => {
  if (!value) return false;
  return /[A-Za-z\u00C0-\u024F]/.test(value);
};

const uniquePush = (arr, value) => {
  if (!value) return;
  if (!arr.includes(value)) arr.push(value);
};

const collectUserIds = (user) => {
  const ids = [];
  if (!user) return ids;

  const candidateKeys = [
    'id', 'ID', 'Id',
    'userId', 'user_id', 'UserId', 'UserID',
    'username', 'Username', 'userName', 'UserName',
    'userCode', 'UserCode', 'employeeCode', 'employeeNumber',
    'employeeId', 'EmployeeId', 'EmployeeID',
    'sub'
  ];

  for (const key of candidateKeys) {
    const value = user[key];
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        const sanitized = sanitizeString(v);
        if (sanitized) uniquePush(ids, sanitized);
      });
    } else {
      const sanitized = sanitizeString(value);
      if (sanitized) uniquePush(ids, sanitized);
    }
  }

  return ids;
};

const collectUserNames = (user) => {
  const names = [];
  if (!user) return names;

  const nameKeys = [
    'displayName', 'DisplayName',
    'fullName', 'FullName', 'UserFullName', 'userFullName',
    'name', 'Name',
    'userName', 'UserName',
    'username', 'Username',
    'preferredName', 'preferred_name',
    'givenName', 'given_name',
    'firstName', 'first_name',
    'lastName', 'last_name',
    'middleName', 'middle_name'
  ];

  for (const key of nameKeys) {
    const value = user[key];
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        const sanitized = sanitizeString(v);
        if (sanitized) uniquePush(names, sanitized);
      });
    } else {
      const sanitized = sanitizeString(value);
      if (sanitized) uniquePush(names, sanitized);
    }
  }

  const first = sanitizeString(user.firstName || user.first_name || user.givenName || user.given_name);
  const middle = sanitizeString(user.middleName || user.middle_name);
  const last = sanitizeString(user.lastName || user.last_name || user.surname);
  const suffix = sanitizeString(user.suffix || user.suffixName);

  const compositeParts = [first];
  if (middle) compositeParts.push(middle);
  if (last) compositeParts.push(last);
  if (suffix) compositeParts.push(suffix);

  if (compositeParts.filter(Boolean).length >= 2) {
    uniquePush(names, compositeParts.join(' '));
  }

  if (user.profile) {
    uniquePush(names, sanitizeString(user.profile.fullName));
    uniquePush(names, sanitizeString(user.profile.displayName));
  }

  if (user.attributes) {
    uniquePush(names, sanitizeString(user.attributes.displayName));
    uniquePush(names, sanitizeString(user.attributes.fullName));
  }

  return names;
};

const collectHeaderNames = (headers = {}) => {
  const values = [];
  NAME_HEADER_KEYS.forEach((key) => {
    const headerValue = headers[key] ?? headers[key.toLowerCase()];
    if (!headerValue) return;
    if (Array.isArray(headerValue)) {
      headerValue.forEach((v) => {
        const sanitized = sanitizeString(v);
        if (sanitized) uniquePush(values, sanitized);
      });
    } else {
      const sanitized = sanitizeString(headerValue);
      if (sanitized) uniquePush(values, sanitized);
    }
  });
  return values;
};

const collectEmails = (user) => {
  if (!user) return [];
  const emails = [];
  ['email', 'Email', 'mail', 'userEmail', 'user_email', 'upn'].forEach((key) => {
    const value = user[key];
    if (!value) return;
    const sanitized = sanitizeString(value);
    if (sanitized && sanitized.includes('@')) uniquePush(emails, sanitized);
  });
  return emails;
};

const pickFirstMeaningfulName = (candidates) => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const sanitized = sanitizeString(candidate);
    if (!sanitized) continue;
    if (isMeaningfulName(sanitized)) return sanitized;
  }
  return null;
};

const normalizeIp = (ip) => {
  if (!ip) return null;
  let value = sanitizeString(ip);
  if (!value) return null;

  // Handle Forwarded header format: for="ip"
  if (/^for=/i.test(value)) {
    value = value.replace(/^for=/i, '').split(';')[0];
    value = value.replace(/^\"|\"$/g, '');
  }

  // Split comma-separated entries and take the first
  if (value.includes(',')) {
    value = value.split(',')[0].trim();
  }

  // Remove IPv6 brackets and zone identifiers
  if (value.startsWith('[') && value.includes(']')) {
    value = value.slice(1, value.indexOf(']'));
  }
  if (value.includes('%')) {
    value = value.split('%')[0];
  }

  // Remove ::ffff: prefix for IPv4-mapped IPv6
  if (value.startsWith('::ffff:')) {
    value = value.slice(7);
  }

  if (value === '::1') {
    return '127.0.0.1';
  }

  // Remove port for IPv4 addresses with port suffix
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(value)) {
    value = value.split(':')[0];
  }

  return value;
};

const getClientIp = (req) => {
  if (!req) return null;
  const headers = req.headers || {};

  for (const key of IP_HEADER_KEYS) {
    const headerValue = headers[key] ?? headers[key.toLowerCase()];
    if (!headerValue) continue;
    const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const normalized = normalizeIp(value);
    if (normalized) return normalized;
  }

  const connectionIp = normalizeIp(
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress
  );
  if (connectionIp) return connectionIp;

  return normalizeIp(req.ip);
};

const fetchIdentityFromDirectory = async (userId) => {
  if (!userId) return { displayName: null, email: null };

  const cached = getCache(userId);
  if (cached) return cached;

  let displayName = null;
  let email = null;
  let source = null;

  if (HierarchicalUserAssignment) {
    try {
      const assignment = await HierarchicalUserAssignment.findOne({ userId }).lean();
      if (assignment) {
        displayName = sanitizeString(assignment.userName) || displayName;
        email = sanitizeString(assignment.email) || email;
        source = 'hierarchical-assignment';
      }
    } catch (error) {
      // Silently ignore directory lookup errors
    }
  }

  if ((!displayName || !email) && UserModel) {
    try {
      const user = await UserModel.findOne({ userId }).lean();
      if (user) {
        displayName = sanitizeString(user.name) || displayName;
        email = sanitizeString(user.email) || email;
        if (!source && displayName) source = 'user-model';
      }
    } catch (error) {
      // Ignore lookup errors
    }
  }

  const result = {
    displayName: displayName || null,
    email: email || null,
    source: source || null
  };

  setCache(userId, result);
  return result;
};

const resolveUserIdentity = async (context = {}) => {
  const req = context.req || context.request;
  const user = context.user || (req ? req.user : context);
  const headers = context.headers || (req ? req.headers : {});

  const userIds = collectUserIds(user);
  const userId = userIds.length ? userIds[0] : null;

  const nameCandidates = [
    ...collectUserNames(user),
    ...collectHeaderNames(headers)
  ];
  const emailCandidates = collectEmails(user);

  let displayName = pickFirstMeaningfulName(nameCandidates);
  let source = displayName ? 'payload' : null;
  let email = emailCandidates.length ? emailCandidates[0] : null;

  if ((!displayName || !isMeaningfulName(displayName)) && userId) {
    const directoryIdentity = await fetchIdentityFromDirectory(userId);
    if (directoryIdentity.displayName && isMeaningfulName(directoryIdentity.displayName)) {
      displayName = directoryIdentity.displayName;
      source = directoryIdentity.source || 'directory';
    }
    if (!email && directoryIdentity.email) {
      email = directoryIdentity.email;
    }
  }

  if (!displayName) {
    displayName = userId ? String(userId) : 'Unknown user';
    if (!source) source = 'fallback';
  }

  return {
    userId: userId ? String(userId) : null,
    displayName,
    email: email || null,
    source
  };
};

const clearIdentityCache = () => identityCache.clear();

module.exports = {
  resolveUserIdentity,
  getClientIp,
  clearIdentityCache,
  __private: {
    sanitizeString,
    isMeaningfulName,
    normalizeIp,
    collectUserIds,
    collectUserNames,
    collectHeaderNames
  }
};
