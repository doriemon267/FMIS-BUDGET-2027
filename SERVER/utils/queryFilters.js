/**
 * Utility functions for MongoDB query filtering
 */

/**
 * Creates a search filter for MongoDB queries across multiple fields
 * @param {Object} query - The MongoDB query object to modify
 * @param {String} searchTerm - The search term to look for
 * @param {Array} fields - Array of field names to search in
 */
exports.searchFilter = (query, searchTerm, fields) => {
  if (!searchTerm || !fields || !fields.length) return;
  
  // Create regex search conditions for each field
  const searchConditions = fields.map(field => ({
    [field]: { $regex: searchTerm, $options: 'i' }
  }));
  
  // Add $or condition to query
  query.$or = searchConditions;
};

/**
 * Creates a text filter for exact match or regex match
 * @param {Object} query - The MongoDB query object to modify
 * @param {String} field - The field name to filter on
 * @param {String} value - The value to filter by
 * @param {String} operator - The operator to use (eq, contains, startsWith, endsWith)
 */
exports.textFilter = (query, field, value, operator = 'eq') => {
  if (!field || value === undefined || value === null || value === '') return;
  
  switch (operator) {
    case 'eq':
      query[field] = value;
      break;
    case 'contains':
      query[field] = { $regex: value, $options: 'i' };
      break;
    case 'startsWith':
      query[field] = { $regex: `^${value}`, $options: 'i' };
      break;
    case 'endsWith':
      query[field] = { $regex: `${value}$`, $options: 'i' };
      break;
    default:
      query[field] = value;
  }
};

/**
 * Creates a numeric filter with various comparison operators
 * @param {Object} query - The MongoDB query object to modify
 * @param {String} field - The field name to filter on
 * @param {Number} value - The value to filter by
 * @param {String} operator - The operator to use (eq, gt, gte, lt, lte)
 */
exports.numberFilter = (query, field, value, operator = 'eq') => {
  if (!field || value === undefined || value === null || value === '') return;
  
  const numValue = Number(value);
  if (isNaN(numValue)) return;
  
  switch (operator) {
    case 'eq':
      query[field] = numValue;
      break;
    case 'gt':
      query[field] = { $gt: numValue };
      break;
    case 'gte':
      query[field] = { $gte: numValue };
      break;
    case 'lt':
      query[field] = { $lt: numValue };
      break;
    case 'lte':
      query[field] = { $lte: numValue };
      break;
    default:
      query[field] = numValue;
  }
};

/**
 * Creates a date filter with various comparison operators
 * @param {Object} query - The MongoDB query object to modify
 * @param {String} field - The field name to filter on
 * @param {String|Date} value - The date value to filter by
 * @param {String} operator - The operator to use (eq, gt, gte, lt, lte)
 */
exports.dateFilter = (query, field, value, operator = 'eq') => {
  if (!field || !value) return;
  
  const dateValue = new Date(value);
  if (isNaN(dateValue.getTime())) return;
  
  switch (operator) {
    case 'eq':
      // For equality, match the entire day
      const startOfDay = new Date(dateValue);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(dateValue);
      endOfDay.setHours(23, 59, 59, 999);
      
      query[field] = { $gte: startOfDay, $lte: endOfDay };
      break;
    case 'gt':
      query[field] = { $gt: dateValue };
      break;
    case 'gte':
      query[field] = { $gte: dateValue };
      break;
    case 'lt':
      query[field] = { $lt: dateValue };
      break;
    case 'lte':
      query[field] = { $lte: dateValue };
      break;
    default:
      query[field] = dateValue;
  }
};