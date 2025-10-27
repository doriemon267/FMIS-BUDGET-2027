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
  // Get current user ID from localStorage or context
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const userId = userData._id;

  if (!userId) {
    throw new Error('User ID not found');
  }

  return getUserActivityLogs(userId, { signal, ...queryParams });
};