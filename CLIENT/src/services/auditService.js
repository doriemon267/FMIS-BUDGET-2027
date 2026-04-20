import api from '../config/api';

function mapUserActivityEntryToAuditLog(entry = {}) {
  return {
    id: entry._id || entry.id,
    timestamp: entry.timestamp,
    proposalId: entry.resource === 'Proposal' ? entry.resourceId : null,
    user: {
      id: entry.userId,
      name: entry.userName || entry.userId || 'Unknown',
      role: Array.isArray(entry.userRoles) && entry.userRoles.length > 0 ? entry.userRoles[0] : ''
    },
    action: entry.action,
    entity: entry.resource,
    summary: entry.details?.subAction ? `${entry.action} (${entry.details.subAction})` : `${entry.action || 'ACTION'} ${entry.resource || 'Resource'}`,
    changes: [],
    metadata: {
      method: entry.method,
      path: entry.path,
      details: entry.details || {},
      snapshot: entry.snapshot || null
    }
  };
}

function normalizeUserActivityResponse(raw = {}, scope = {}) {
  const list = Array.isArray(raw.data) ? raw.data : [];
  const page = raw.pagination?.page || 1;
  const limit = raw.pagination?.limit || list.length || 0;
  const total = raw.pagination?.total ?? list.length;

  return {
    success: true,
    data: {
      ...scope,
      logs: list.map(mapUserActivityEntryToAuditLog),
      total,
      pagination: {
        page,
        limit,
        hasMore: page * limit < total,
      },
    },
  };
}

/**
 * Service for Audit Logging operations
 */

/**
 * Get detailed field-level edit logs for a specific proposal
 * @param {string} proposalId - The proposal ID
 * @param {Object} options - Query options (entityType, startDate, endDate, limit, page)
 * @returns {Promise} API response with audit logs
 */
export const getProposalAuditLogs = async (proposalId, options = {}) => {
  const { signal, ...queryParams } = options || {};
  try {
    const response = await api.get(`/api/workflow/audit/proposal/${proposalId}`, {
      params: queryParams,
      signal
    });

    const legacyLogs = response?.data?.data?.logs;
    if (Array.isArray(legacyLogs) && legacyLogs.length > 0) {
      return response.data;
    }
  } catch (_legacyError) {
    // Fallback below will use active UserActivityLog source.
  }

  const fallbackResponse = await api.get('/user-activity-logs', {
    params: {
      ...queryParams,
      resource: 'Proposal',
      resourceId: proposalId,
    },
    signal,
  });

  return normalizeUserActivityResponse(fallbackResponse.data, { proposalId });
};

/**
 * Get user activity logs (all changes made by a specific user)
 * @param {string} userId - The user ID
 * @param {Object} options - Query options (startDate, endDate, limit, page, entityType)
 * @returns {Promise} API response with user activity logs
 */
export const getUserActivityLogs = async (userId, options = {}) => {
  const { signal, ...queryParams } = options || {};
  // Apply user filter at API level to align with legacy behavior.
  const filtered = await api.get('/user-activity-logs', {
    params: {
      ...queryParams,
      userId,
    },
    signal
  });

  return normalizeUserActivityResponse(filtered.data, { userId });
};

/**
 * Get current user's activity logs
 * @param {Object} options - Query options (startDate, endDate, limit, page, entityType)
 * @returns {Promise} API response with current user's activity logs
 */
export const getMyActivityLogs = async (options = {}) => {
  const { signal, ...queryParams } = options || {};
  // Prefer an explicit userId if caller provided one
  if (options.userId) {
    const uid = options.userId;
    delete queryParams.userId;
    return getUserActivityLogs(uid, { signal, ...queryParams });
  }

  // Otherwise, fetch the authenticated user from the auth server (uses httpOnly cookie)
  try {
    const { authApi } = await import('../config/api');
    const res = await authApi.get('/get-user');
    const user = res?.data?.user;
    const userId = user?.particularID || user?.Id || user?.id || user?.userId || null;
    if (!userId) throw new Error('Authenticated user not available');
    return getUserActivityLogs(userId, { signal, ...queryParams });
  } catch (err) {
    console.error('getMyActivityLogs: unable to determine current user', err?.message || err);
    throw err;
  }
};