import api from '../config/api';

/**
 * Service for Budget Officer Edit operations
 */

/**
 * Get proposal data for editing (all 4 tables)
 * @param {string} proposalId - The proposal ID
 * @returns {Promise} API response with all table data
 */
export const getProposalForEdit = async (proposalId, options = {}) => {
  const { signal, params: extraParams, ...restOptions } = options || {};
  const response = await api.get('/api/budget-officer-edits/proposal-for-edit', {
    params: { proposalId, ...(extraParams || {}) },
    signal,
    ...restOptions
  });
  return response.data;
};

/**
 * Save draft edits
 * @param {Object} editData - The edit data
 * @returns {Promise} API response
 */
export const saveDraftEdit = async (editData) => {
  const response = await api.post('/api/budget-officer-edits/draft', editData);
  return response.data;
};

/**
 * Submit edits for approval
 * @param {Object} editData - The edit data
 * @returns {Promise} API response
 */
export const submitEdit = async (editData) => {
  const response = await api.post('/api/budget-officer-edits/submit', editData);
  return response.data;
};

/**
 * Get comparison data for Preparer view
 * @param {string} proposalId - The proposal ID
 * @returns {Promise} API response with comparison data
 */
export const getComparisonData = async (proposalId, options = {}) => {
  const { signal, ...restOptions } = options || {};
  const response = await api.get(`/api/budget-officer-edits/comparison/${proposalId}`, {
    signal,
    ...restOptions
  });
  return response.data;
};

/**
 * Get edit by ID
 * @param {string} editId - The edit ID
 * @returns {Promise} API response
 */
export const getEditById = async (editId) => {
  const response = await api.get(`/api/budget-officer-edits/${editId}`);
  return response.data;
};

/**
 * Get all edits for a proposal
 * @param {string} proposalId - The proposal ID
 * @returns {Promise} API response
 */
export const getEditsByProposal = async (proposalId) => {
  const response = await api.get(`/api/budget-officer-edits/proposal/${proposalId}`);
  return response.data;
};

/**
 * Delete draft edit
 * @param {string} editId - The edit ID
 * @returns {Promise} API response
 */
export const deleteDraftEdit = async (editId) => {
  const response = await api.delete(`/api/budget-officer-edits/${editId}`);
  return response.data;
};

/**
 * Approve edit (Budget Manager or higher)
 * @param {string} editId - The edit ID
 * @returns {Promise} API response
 */
export const approveEdit = async (editId) => {
  const response = await api.post(`/api/budget-officer-edits/${editId}/approve`);
  return response.data;
};