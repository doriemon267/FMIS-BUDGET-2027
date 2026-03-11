const User = require('../models/User');

const toTrimmedString = (value) => String(value || '').trim();
const toRawString = (value) => (value === undefined || value === null ? '' : String(value));
const isDebugRuntime = () => String(process.env.NODE_ENV || '').toLowerCase() !== 'production';

const uniqueStrings = (values = []) => {
  return [...new Set(values.map(toTrimmedString).filter(Boolean))];
};

const getUserIdentifierCandidates = (user = {}) => {
  const fromUsernameArray = Array.isArray(user?.Username) ? user.Username : [];
  const fromRolesArray = Array.isArray(user?.UserName) ? user.UserName : [];

  return uniqueStrings([
    user?.userId,
    user?.id,
    user?.particularID,
    user?.particularId,
    user?.username,
    user?.UserName,
    ...fromUsernameArray,
    ...fromRolesArray,
    user?.email,
    user?.Email,
  ]);
};

const getNumericVariants = (values = []) => {
  const nums = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => String(value));
  return uniqueStrings(nums);
};

const extractAccountIdentityCandidates = (identityPayload = {}) => {
  const usernameArray = Array.isArray(identityPayload?.Username) ? identityPayload.Username : [];
  const userNameArray = Array.isArray(identityPayload?.UserName) ? identityPayload.UserName : [];

  return uniqueStrings([
    ...usernameArray,
    identityPayload?.username,
    identityPayload?.Username,
    identityPayload?.UserName,
    ...userNameArray,
    identityPayload?.email,
    identityPayload?.Email,
    identityPayload?.id,
    identityPayload?.userId,
    identityPayload?.Id,
  ]);
};

const fetchAccountIdentityCandidatesFromAccessToken = async (user = {}) => {
  const accountUserApiUrl = toTrimmedString(process.env.ACCOUNT_USER_API_URL);
  const accessTokenCandidates = uniqueStrings([
    user?.accessToken,
    user?.AccessToken,
    user?.token,
    user?.authToken,
  ]);

  if (!accountUserApiUrl || accessTokenCandidates.length === 0) {
    return [];
  }

  for (const accessToken of accessTokenCandidates) {
    try {
      const response = await fetch(accountUserApiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data) continue;

      const payload = data.user || data.data || data;
      const candidates = extractAccountIdentityCandidates(payload);
      if (candidates.length > 0) {
        return candidates;
      }
    } catch (_) {
      // Ignore and try next token candidate
    }
  }

  return [];
};

const verifyAgainstExternalAuth = async ({ usernameCandidates, password }) => {
  const tokenApi = process.env.ACCOUNT_TOKEN_API_URL;
  const clientIds = uniqueStrings([
    process.env.CLIENT_ID,
    process.env.ACCOUNT_CLIENT_ID,
    process.env.CLIENTOWNER_ID,
  ]);
  const ownerIds = uniqueStrings([
    process.env.OWNER_ID,
    process.env.CLIENTOWNER_ID,
  ]);

  if (!tokenApi || clientIds.length === 0) {
    return {
      valid: false,
      reasonCode: 'external-not-configured',
      details: {
        hasTokenApi: Boolean(tokenApi),
        hasClientIds: clientIds.length > 0,
        hasOwnerIds: ownerIds.length > 0,
      },
    };
  }

  const credentialPairs = [];
  clientIds.forEach((clientId) => {
    if (ownerIds.length > 0) {
      ownerIds.forEach((ownerId) => {
        credentialPairs.push({ mode: 'pair', clientId, ownerId });
      });
    }

    credentialPairs.push({ mode: 'empty-owner', clientId, ownerId: '' });
    credentialPairs.push({ mode: 'self-pair', clientId, ownerId: clientId });
    credentialPairs.push({ mode: 'raw-single', clientId, ownerId: null });
  });

  const triedPairs = new Set();

  const uniquePairs = credentialPairs.filter(({ mode, clientId, ownerId }) => {
    const key = `${mode}:${clientId}:${ownerId === null ? 'NULL' : ownerId}`;
    if (triedPairs.has(key)) return false;
    triedPairs.add(key);
    return true;
  });

  let hadNetworkError = false;

  for (const username of usernameCandidates) {
    for (const { mode, clientId, ownerId } of uniquePairs) {
      try {
        const rawCredential =
          mode === 'raw-single'
            ? String(clientId)
            : `${clientId}:${ownerId == null ? '' : ownerId}`;
        const encodedCredentials = Buffer.from(rawCredential).toString('base64');
        const response = await fetch(tokenApi, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${encodedCredentials}`,
          },
          body: new URLSearchParams({
            grant_type: 'password',
            username,
            password,
          }),
        });

        const data = await response.json().catch(() => null);
        if (response.ok && data?.access_token) {
          return {
            valid: true,
            reasonCode: 'external-password-match',
            details: {
              mode,
              username,
            },
          };
        }
      } catch (_) {
        // Continue trying next credential/username candidate
        hadNetworkError = true;
      }
    }
  }

  return {
    valid: false,
    reasonCode: hadNetworkError ? 'external-unreachable-or-failed' : 'external-password-mismatch',
    details: {
      triedUsernamesCount: usernameCandidates.length,
      triedUsernames: usernameCandidates.slice(0, 10),
      triedCredentialModesCount: uniquePairs.length,
    },
  };
};

const verifyAccountReauthPasswordDetailed = async ({ user, password, bcrypt, extraIdentifiers = [], extraUsernames = [] }) => {
  const plainPassword = toRawString(password);
  if (!plainPassword.length) {
    return {
      valid: false,
      source: 'input',
      reasonCode: 'missing-password',
      details: {},
    };
  }

  const identifiers = uniqueStrings([
    ...getUserIdentifierCandidates(user),
    ...extraIdentifiers,
  ]);
  const numericVariants = getNumericVariants(identifiers);
  const idCandidates = uniqueStrings([...identifiers, ...numericVariants]);

  let userDoc = null;
  if (idCandidates.length > 0) {
    userDoc = await User.findOne({ userId: { $in: idCandidates } })
      .select('password userId email')
      .lean();
  }

  if (!userDoc) {
    const emailCandidates = uniqueStrings([user?.email, user?.Email]);
    if (emailCandidates.length > 0) {
      userDoc = await User.findOne({ email: { $in: emailCandidates } })
        .select('password userId email')
        .lean();
    }
  }

  if (userDoc?.password) {
    const valid = await bcrypt.compare(plainPassword, String(userDoc.password));
    if (valid) {
      return {
        valid: true,
        source: 'local-user-hash',
        reasonCode: 'local-password-match',
        details: {},
      };
    }
  }

  const usernameCandidates = uniqueStrings([
    ...(Array.isArray(user?.Username) ? user.Username : []),
    user?.username,
    user?.UserName,
    user?.userId,
    user?.id,
    user?.particularID,
    user?.email,
    ...extraUsernames,
  ]);

  if (usernameCandidates.length === 0) {
    return {
      valid: false,
      source: userDoc ? 'local-user-hash' : 'lookup',
      reasonCode: userDoc?.password ? 'local-password-mismatch' : 'no-username-candidates',
      details: {
        localUserFound: Boolean(userDoc),
        localUserHasPassword: Boolean(userDoc?.password),
      },
    };
  }

  const externalResult = await verifyAgainstExternalAuth({ usernameCandidates, password: plainPassword });
  if (!externalResult.valid) {
    const identityCandidates = await fetchAccountIdentityCandidatesFromAccessToken(user);
    const retryUsernames = uniqueStrings([...usernameCandidates, ...identityCandidates]);

    if (retryUsernames.length > usernameCandidates.length) {
      const retryResult = await verifyAgainstExternalAuth({ usernameCandidates: retryUsernames, password: plainPassword });
      if (retryResult.valid) {
        return {
          ...retryResult,
          source: 'external-auth-account-identity',
          details: {
            ...(retryResult.details || {}),
            identityCandidatesAdded: identityCandidates.length,
            localUserFound: Boolean(userDoc),
            localUserHasPassword: Boolean(userDoc?.password),
          },
        };
      }

      return {
        ...retryResult,
        source: userDoc?.password ? 'local-then-external' : 'external-auth',
        details: {
          ...(retryResult.details || {}),
          identityCandidatesAdded: identityCandidates.length,
          localUserFound: Boolean(userDoc),
          localUserHasPassword: Boolean(userDoc?.password),
        },
      };
    }
  }

  return {
    ...externalResult,
    source: externalResult.valid ? 'external-auth' : (userDoc?.password ? 'local-then-external' : 'external-auth'),
    details: {
      ...(externalResult.details || {}),
      localUserFound: Boolean(userDoc),
      localUserHasPassword: Boolean(userDoc?.password),
    },
  };
};

const verifyAccountReauthPassword = async (args) => {
  const result = await verifyAccountReauthPasswordDetailed(args);
  return Boolean(result?.valid);
};

module.exports = {
  verifyAccountReauthPassword,
  verifyAccountReauthPasswordDetailed,
  isDebugRuntime,
};
