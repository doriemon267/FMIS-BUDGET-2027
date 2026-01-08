import api from '../config/api';

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
  const response = await api.get(`/api/workflow/audit/proposal/${proposalId}`, {
    params: queryParams,
    signal
  });
  return response.data;
};

/**
 * Get user activity logs (all changes made by a specific user)
 * @param {string} userId - The user ID
 * @param {Object} options - Query options (startDate, endDate, limit, page, entityType)
 * @returns {Promise} API response with user activity logs
 */
export const getUserActivityLogs = async (userId, options = {}) => {
  const { signal, ...queryParams } = options || {};
  const response = await api.get(`/api/workflow/audit/user/${userId}`, {
    params: queryParams,
    signal
  });
  return response.data;
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
    const userId = user?.id || user?.userId || user?.Id || null;
    if (!userId) throw new Error('Authenticated user not available');
    return getUserActivityLogs(userId, { signal, ...queryParams });
  } catch (err) {
    console.error('getMyActivityLogs: unable to determine current user', err?.message || err);
    throw err;
  }
};