/**
 * Validation utilities for form inputs
 */

/**
 * Validate email format
 */
export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * Validate phone number (Philippines format)
 */
export const validatePhone = (phone) => {
  const re = /^(\+63|0)?[9]\d{9}$/;
  return re.test(phone.replace(/\s+/g, ''));
};

/**
 * Validate required field
 */
export const validateRequired = (value) => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined && value !== '';
};

/**
 * Validate number range
 */
export const validateRange = (value, min, max) => {
  const num = Number(value);
  if (isNaN(num)) return false;
  return num >= min && num <= max;
};

/**
 * Validate minimum value
 */
export const validateMin = (value, min) => {
  const num = Number(value);
  if (isNaN(num)) return false;
  return num >= min;
};

/**
 * Validate maximum value
 */
export const validateMax = (value, max) => {
  const num = Number(value);
  if (isNaN(num)) return false;
  return num <= max;
};

/**
 * Validate UACS code format
 */
export const validateUACS = (code) => {
  const re = /^[0-9\-]+$/;
  return re.test(code) && code.length <= 20;
};

/**
 * Validate fiscal year format (YYYY)
 */
export const validateFiscalYear = (year) => {
  const num = Number(year);
  if (isNaN(num)) return false;
  return num >= 2000 && num <= 2100;
};

/**
 * Get validation error message
 */
export const getValidationMessage = (field, rule, value, options = {}) => {
  const messages = {
    required: `${field} is required`,
    email: `Please enter a valid email address`,
    phone: `Please enter a valid phone number`,
    min: `${field} must be at least ${options.min}`,
    max: `${field} must not exceed ${options.max}`,
    range: `${field} must be between ${options.min} and ${options.max}`,
    uacs: `Invalid UACS code format`,
    fiscalYear: `Please enter a valid fiscal year (2000-2100)`,
  };

  return messages[rule] || `${field} is invalid`;
};

/**
 * Real-time validation helper
 */
export const createValidator = (rules) => {
  return (field, value) => {
    const errors = [];

    for (const rule of rules) {
      let isValid = true;

      switch (rule.type) {
        case 'required':
          isValid = validateRequired(value);
          break;
        case 'email':
          isValid = !value || validateEmail(value);
          break;
        case 'phone':
          isValid = !value || validatePhone(value);
          break;
        case 'min':
          isValid = !value || validateMin(value, rule.value);
          break;
        case 'max':
          isValid = !value || validateMax(value, rule.value);
          break;
        case 'range':
          isValid = !value || validateRange(value, rule.min, rule.max);
          break;
        case 'uacs':
          isValid = !value || validateUACS(value);
          break;
        case 'fiscalYear':
          isValid = !value || validateFiscalYear(value);
          break;
        case 'custom':
          isValid = rule.validator ? rule.validator(value) : true;
          break;
        default:
          isValid = true;
      }

      if (!isValid) {
        errors.push({
          type: rule.type,
          message: rule.message || getValidationMessage(field, rule.type, value, rule),
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };
};

export default {
  validateEmail,
  validatePhone,
  validateRequired,
  validateRange,
  validateMin,
  validateMax,
  validateUACS,
  validateFiscalYear,
  getValidationMessage,
  createValidator,
};
