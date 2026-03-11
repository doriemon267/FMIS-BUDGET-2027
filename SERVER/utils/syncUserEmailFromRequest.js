const User = require('../models/User');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');

const normalizeString = (value) => String(value || '').trim();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeString(value));
const pickEmailFromUsernameArray = (value) => {
  if (!Array.isArray(value)) return null;
  const fromIndexOne = normalizeString(value[1]);
  if (fromIndexOne && isValidEmail(fromIndexOne)) return fromIndexOne;
  const anyEmail = value.map((item) => normalizeString(item)).find((item) => isValidEmail(item));
  return anyEmail || null;
};

const fetchCanonicalEmailFromAccountApi = async (req = {}) => {
  const accountUserApiUrl = normalizeString(process.env.ACCOUNT_USER_API_URL);
  if (!accountUserApiUrl) return null;

  const user = req.user || {};
  const tokenCandidates = [
    user?.accessToken,
    user?.AccessToken,
    user?.token,
    user?.authToken,
  ]
    .map((value) => normalizeString(value))
    .filter((value) => value !== '');

  if (!tokenCandidates.length) return null;

  for (const accessToken of tokenCandidates) {
    try {
      const response = await fetch(accountUserApiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) continue;

      const data = await response.json().catch(() => null);
      const payload = data?.user || data?.data || data || {};
      const resolved =
        payload?.email ||
        payload?.Email ||
        payload?.userEmail ||
        payload?.UserEmail ||
        payload?.mail ||
        null;

      const normalized = normalizeString(resolved);
      if (normalized) return normalized;
    } catch (_error) {
      // try next token candidate
    }
  }

  return null;
};

const buildIdCandidates = (req = {}) => {
  const user = req.user || {};
  const candidates = [
    user?.particularID,
    user?.particularId,
    user?.Id,
    user?.id,
    user?.userId,
    user?.UserId,
    req?.headers?.['x-dev-user-id'],
    req?.headers?.['X-Dev-User-Id'],
  ];

  const usernames = [
    ...(Array.isArray(user?.Username) ? user.Username : [user?.Username]),
    ...(Array.isArray(user?.username) ? user.username : [user?.username]),
  ];

  usernames.forEach((value) => candidates.push(value));

  const stringIds = Array.from(
    new Set(
      candidates
        .map((value) => normalizeString(value))
        .filter((value) => value !== '')
    )
  );

  const numericIds = Array.from(
    new Set(
      stringIds
        .map((value) => {
          const parsed = Number(value);
          return Number.isNaN(parsed) ? null : parsed;
        })
        .filter((value) => value !== null)
    )
  );

  return [...stringIds, ...numericIds];
};

const getCanonicalEmail = (req = {}) => {
  const user = req.user || {};
  const usernameArrayEmail =
    pickEmailFromUsernameArray(user?.Username) ||
    pickEmailFromUsernameArray(user?.username) ||
    null;
  const email =
    user?.email ||
    user?.Email ||
    user?.userEmail ||
    user?.UserEmail ||
    user?.mail ||
    usernameArrayEmail ||
    req?.headers?.['x-dev-email'] ||
    req?.headers?.['X-Dev-Email'] ||
    null;

  const normalized = normalizeString(email);
  return normalized || null;
};

const syncUserEmailFromRequest = async (req = {}) => {
  const canonicalEmail = getCanonicalEmail(req) || await fetchCanonicalEmailFromAccountApi(req);
  if (!canonicalEmail) return;

  const allIds = buildIdCandidates(req);
  if (!allIds.length) return;

  await Promise.all([
    User.updateMany(
      { userId: { $in: allIds }, email: { $ne: canonicalEmail } },
      { $set: { email: canonicalEmail } }
    ),
    HierarchicalUserAssignment.updateMany(
      { userId: { $in: allIds }, email: { $ne: canonicalEmail } },
      { $set: { email: canonicalEmail } }
    )
  ]);
};

module.exports = {
  syncUserEmailFromRequest,
};
