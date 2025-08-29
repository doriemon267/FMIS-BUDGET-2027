const { body, param, query, validationResult } = require('express-validator');

// MongoDB injection prevention middleware
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (let key in obj) {
        if (typeof obj[key] === 'string') {
          // Remove MongoDB operators and dangerous characters
          obj[key] = obj[key].replace(/[\$\.]/g, '');
          // Basic XSS prevention
          obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(item => sanitize(item));
    }
  };
  
  // Sanitize all input sources
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);
  
  next();
};

// MOOE data validation rules
const validateMooeData = [
  body('*.income')
    .optional()
    .isNumeric()
    .withMessage('Income must be a number')
    .custom(value => value >= 0)
    .withMessage('Income cannot be negative'),
  
  body('*.subsidy')
    .optional()
    .isNumeric()
    .withMessage('Subsidy must be a number')
    .custom(value => value >= 0)
    .withMessage('Subsidy cannot be negative'),
    
  body('*.uacsCode')
    .optional()
    .matches(/^[0-9\-]+$/)
    .withMessage('Invalid UACS code format')
    .isLength({ max: 20 })
    .withMessage('UACS code too long'),
    
  body('*.region')
    .optional()
    .isLength({ min: 1, max: 100 })
    .escape()
    .withMessage('Invalid region'),
    
  body('*.sublineItem')
    .optional()
    .isLength({ max: 200 })
    .escape()
    .withMessage('Subline item too long'),
    
  body('*.accountingTitle')
    .optional()
    .isLength({ max: 200 })
    .escape()
    .withMessage('Accounting title too long')
];

// File upload validation
const validateFileUpload = [
  body('activeRegion')
    .notEmpty()
    .withMessage('Region is required')
    .isLength({ max: 100 })
    .escape(),
    
  body('processBy')
    .optional()
    .isLength({ max: 100 })
    .escape()
    .withMessage('Process by field too long')
];

// Employee data validation
const validateEmployeeData = [
  body('*.firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .escape()
    .withMessage('First name required and must be less than 50 characters'),
    
  body('*.lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .escape()
    .withMessage('Last name required and must be less than 50 characters'),
    
  body('*.email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
    
  body('*.employeeId')
    .optional()
    .matches(/^[A-Z0-9\-]+$/)
    .withMessage('Invalid employee ID format')
    .isLength({ max: 20 })
    .withMessage('Employee ID too long')
];

// Income data validation
const validateIncomeData = [
  body('*.amount')
    .optional()
    .isNumeric()
    .withMessage('Amount must be a number')
    .custom(value => value >= 0)
    .withMessage('Amount cannot be negative'),
    
  body('*.categoryName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .escape()
    .withMessage('Category name required'),
    
  body('*.subcategoryName')
    .optional()
    .isLength({ max: 100 })
    .escape()
    .withMessage('Subcategory name too long')
];

// Parameter validation for routes
const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format')
];

const validateRegionParam = [
  query('region')
    .optional()
    .isLength({ min: 1, max: 100 })
    .escape()
    .withMessage('Invalid region parameter')
];

const validatePaginationParams = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer (max 1000)'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('orderBy')
    .optional()
    .matches(/^[a-zA-Z_]+$/)
    .withMessage('Invalid orderBy field'),
    
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc')
];

// Error handler for validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Advanced sanitization for specific data types
const sanitizeMongoQuery = (query) => {
  if (typeof query !== 'object' || query === null) {
    return query;
  }
  
  const sanitized = {};
  for (const key in query) {
    if (query.hasOwnProperty(key)) {
      // Remove dangerous operators
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      
      if (typeof query[key] === 'object' && query[key] !== null) {
        sanitized[key] = sanitizeMongoQuery(query[key]);
      } else if (typeof query[key] === 'string') {
        // Escape special regex characters for safe regex queries
        sanitized[key] = query[key].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      } else {
        sanitized[key] = query[key];
      }
    }
  }
  return sanitized;
};

// Rate limiting validation
const validateRateLimit = (req, res, next) => {
  // Track request frequency per user
  if (req.user) {
    req.userKey = `user_${req.user.id}`;
  } else {
    req.userKey = `ip_${req.ip}`;
  }
  next();
};

module.exports = {
  sanitizeInput,
  validateMooeData,
  validateFileUpload,
  validateEmployeeData,
  validateIncomeData,
  validateObjectId,
  validateRegionParam,
  validatePaginationParams,
  handleValidationErrors,
  sanitizeMongoQuery,
  validateRateLimit
};
