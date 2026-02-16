/**
 * Centralized error handling utilities
 * Provides user-friendly error messages and error recovery
 */

import logger from './logger';

/**
 * Get user-friendly error message from error object
 */
export const getErrorMessage = (error) => {
  if (!error) return 'An unexpected error occurred';

  // Handle API error responses
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return data?.message || data?.error || 'Invalid request. Please check your input.';
      case 401:
        return 'You are not authorized. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return data?.message || 'This action conflicts with existing data.';
      case 422:
        return data?.message || data?.error || 'Validation failed. Please check your input.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Server error. Please try again later or contact support.';
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return data?.message || data?.error || `Error ${status}: ${error.message}`;
    }
  }

  // Handle network errors
  if (error.message === 'Network Error' || error.code === 'NETWORK_ERROR') {
    return 'Network error. Please check your internet connection and try again.';
  }

  // Handle timeout errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // Handle generic error messages
  if (error.message) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
};

/**
 * Get actionable error message with recovery suggestions
 */
export const getActionableErrorMessage = (error, context = '') => {
  const baseMessage = getErrorMessage(error);
  
  if (!error.response) {
    return {
      message: baseMessage,
      action: 'Please check your internet connection and try again.',
      retry: true,
    };
  }

  const { status } = error.response;
  
  switch (status) {
    case 400:
      return {
        message: baseMessage,
        action: 'Please review your input and correct any errors.',
        retry: false,
      };
    case 401:
      return {
        message: baseMessage,
        action: 'Click here to log in again.',
        retry: false,
        redirect: '/login',
      };
    case 403:
      return {
        message: baseMessage,
        action: 'Contact your administrator if you believe this is an error.',
        retry: false,
      };
    case 404:
      return {
        message: baseMessage,
        action: 'The item may have been deleted or moved.',
        retry: false,
      };
    case 429:
      return {
        message: baseMessage,
        action: 'Wait a few moments before trying again.',
        retry: true,
        retryDelay: 5000,
      };
    case 500:
    case 503:
      return {
        message: baseMessage,
        action: 'The issue has been reported. Please try again in a few moments.',
        retry: true,
        retryDelay: 3000,
      };
    default:
      return {
        message: baseMessage,
        action: 'Please try again or contact support if the problem persists.',
        retry: true,
      };
  }
};

/**
 * Log error with context
 */
export const logError = (error, context = '') => {
  const errorMessage = getErrorMessage(error);
  logger.error(`[${context}] ${errorMessage}`, error);
  
  // In production, send to error tracking service
  // if (window.Sentry && !isDevelopment) {
  //   window.Sentry.captureException(error, {
  //     tags: { context },
  //   });
  // }
};

/**
 * Handle API error with user notification
 */
export const handleApiError = (error, toast, context = '') => {
  const errorInfo = getActionableErrorMessage(error, context);
  logError(error, context);
  
  if (toast) {
    toast.error(errorInfo.message, {
      description: errorInfo.action,
      duration: errorInfo.retry ? 5000 : 4000,
    });
  }
  
  return errorInfo;
};

export default {
  getErrorMessage,
  getActionableErrorMessage,
  logError,
  handleApiError,
};
