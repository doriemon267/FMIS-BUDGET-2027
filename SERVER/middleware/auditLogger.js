/**
 * Audit logging middleware for sensitive actions
 */

const AuditLog = require('../models/AuditLog');

/**
 * Create audit log entry
 */
const createAuditLog = async (req, action, details = {}) => {
  try {
    const userId = req.user?.Id || req.user?.id || req.user?.userId || 'anonymous';
    const userName = req.user?.FirstName || req.user?.name || 'Unknown User';
    const userRoles = req.user?.Roles || [];
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    const auditEntry = {
      userId,
      userName,
      userRoles,
      action,
      resource: details.resource || req.path,
      resourceId: details.resourceId || req.params?.id || null,
      method: req.method,
      ipAddress,
      userAgent,
      details: {
        ...details,
        body: sanitizeSensitiveData(req.body),
        query: req.query,
        params: req.params,
      },
      timestamp: new Date(),
    };

    await AuditLog.create(auditEntry);
  } catch (error) {
    console.error('[AuditLogger] Failed to create audit log:', error.message);
    // Don't throw - audit logging should not break the request
  }
};

/**
 * Sanitize sensitive data from audit logs
 */
const sanitizeSensitiveData = (data) => {
  if (!data || typeof data !== 'object') return data;

  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  const sanitized = { ...data };

  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });

  return sanitized;
};

/**
 * Middleware to log sensitive actions
 */
const auditLogger = (action, options = {}) => {
  return async (req, res, next) => {
    // Log before action
    if (options.logBefore) {
      await createAuditLog(req, `${action}_ATTEMPT`, options.details);
    }

    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      // Log after action (only if successful)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        createAuditLog(req, action, {
          ...options.details,
          responseStatus: res.statusCode,
        }).catch((err) => {
          console.error('[AuditLogger] Error logging response:', err.message);
        });
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Log specific actions
 */
const logProposalAction = (req, res, next) => {
  return auditLogger('PROPOSAL_ACTION', {
    logBefore: true,
    details: {
      resource: 'proposal',
      resourceId: req.params?.id,
    },
  })(req, res, next);
};

const logWorkflowAction = (req, res, next) => {
  return auditLogger('WORKFLOW_ACTION', {
    logBefore: true,
    details: {
      resource: 'workflow',
      resourceId: req.params?.id,
      action: req.body?.action,
    },
  })(req, res, next);
};

const logDataModification = (req, res, next) => {
  return auditLogger('DATA_MODIFICATION', {
    logBefore: true,
    details: {
      resource: req.path.split('/')[1] || 'unknown',
      resourceId: req.params?.id,
    },
  })(req, res, next);
};

const logUserAction = (req, res, next) => {
  return auditLogger('USER_ACTION', {
    logBefore: true,
    details: {
      resource: 'user',
      resourceId: req.params?.id || req.user?.id,
    },
  })(req, res, next);
};

module.exports = {
  createAuditLog,
  auditLogger,
  logProposalAction,
  logWorkflowAction,
  logDataModification,
  logUserAction,
};
