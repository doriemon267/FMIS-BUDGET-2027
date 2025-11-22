const HierarchicalUserAssignment = require("../models/HierarchicalUserAssignment");

/**
 * Middleware to enforce access restrictions based on user's hierarchical assignment
 * This checks allowedBudgetTypes, allowedFiscalYears, and readOnlyMode
 */
const enforceAccessRestrictions = (options = {}) => {
  const {
    checkBudgetType = false,
    checkFiscalYear = false,
    checkReadOnly = false,
    budgetTypeField = 'budgetType',
    fiscalYearField = 'fiscalYear'
  } = options;

  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const userRoles = req.user?.Roles || [];
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      // SUPER ADMIN bypasses all restrictions
      if (userRoles.includes('SUPER ADMIN') || userRoles.includes('SUPER_ADMIN')) {
        return next();
      }

      // Get user's hierarchical assignment with restrictions
      const assignment = await HierarchicalUserAssignment.findOne({
        userId,
        isActive: true
      });

      if (!assignment || !assignment.restrictions) {
        // No restrictions configured, allow access
        return next();
      }

      const { restrictions } = assignment;

      // Check read-only mode
      if (checkReadOnly && restrictions.readOnlyMode) {
        // For read operations, allow but mark as read-only
        if (req.method === 'GET') {
          req.isReadOnly = true;
          return next();
        }

        // For write operations, block
        return res.status(403).json({
          success: false,
          message: 'Account is in read-only mode. Modifications are not allowed.',
          code: 'READ_ONLY_MODE'
        });
      }

      // Check budget type restrictions
      if (checkBudgetType && restrictions.allowedBudgetTypes && restrictions.allowedBudgetTypes.length > 0) {
        const requestBudgetType = req.body[budgetTypeField] || req.query[budgetTypeField] || req.params[budgetTypeField];

        if (requestBudgetType && !restrictions.allowedBudgetTypes.includes(requestBudgetType)) {
          return res.status(403).json({
            success: false,
            message: `Access denied. You are not authorized to work with budget type: ${requestBudgetType}`,
            code: 'BUDGET_TYPE_RESTRICTED',
            allowedBudgetTypes: restrictions.allowedBudgetTypes
          });
        }
      }

      // Check fiscal year restrictions
      if (checkFiscalYear && restrictions.allowedFiscalYears && restrictions.allowedFiscalYears.length > 0) {
        const requestFiscalYear = req.body[fiscalYearField] || req.query[fiscalYearField] || req.params[fiscalYearField];

        if (requestFiscalYear && !restrictions.allowedFiscalYears.includes(requestFiscalYear.toString())) {
          return res.status(403).json({
            success: false,
            message: `Access denied. You are not authorized to work with fiscal year: ${requestFiscalYear}`,
            code: 'FISCAL_YEAR_RESTRICTED',
            allowedFiscalYears: restrictions.allowedFiscalYears
          });
        }
      }

      next();
    } catch (error) {
      console.error('Error enforcing access restrictions:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking access restrictions',
        error: error.message
      });
    }
  };
};

/**
 * Helper function to check if user has access to specific budget type and fiscal year
 */
const checkUserAccessToData = async (userId, budgetType, fiscalYear) => {
  try {
    const assignment = await HierarchicalUserAssignment.findOne({
      userId,
      isActive: true
    });

    if (!assignment || !assignment.restrictions) {
      return { hasAccess: true, restrictions: null };
    }

    const { restrictions } = assignment;
    let hasAccess = true;
    let restrictionReason = null;

    // Check budget type
    if (restrictions.allowedBudgetTypes && restrictions.allowedBudgetTypes.length > 0) {
      if (budgetType && !restrictions.allowedBudgetTypes.includes(budgetType)) {
        hasAccess = false;
        restrictionReason = `Budget type '${budgetType}' not allowed`;
      }
    }

    // Check fiscal year
    if (restrictions.allowedFiscalYears && restrictions.allowedFiscalYears.length > 0) {
      if (fiscalYear && !restrictions.allowedFiscalYears.includes(fiscalYear.toString())) {
        hasAccess = false;
        restrictionReason = `Fiscal year '${fiscalYear}' not allowed`;
      }
    }

    return {
      hasAccess,
      restrictions,
      restrictionReason,
      isReadOnly: restrictions.readOnlyMode || false
    };
  } catch (error) {
    console.error('Error checking user access:', error);
    return { hasAccess: false, restrictions: null, restrictionReason: 'Error checking access' };
  }
};

module.exports = {
  enforceAccessRestrictions,
  checkUserAccessToData
};