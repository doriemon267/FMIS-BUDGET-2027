import React from 'react';
import { Box, Chip, Typography, Alert, Tooltip } from '@mui/material';
import { Lock, LockOpen, Warning } from '@mui/icons-material';
import { useUserRestrictions } from '../../hooks/useUserRestrictions';

/**
 * Component to display user access status and restrictions
 */
export const AccessStatusIndicator = () => {
  const { readOnly, restrictions } = useUserRestrictions();

  if (!readOnly && (!restrictions.allowedBudgetTypes || restrictions.allowedBudgetTypes.length === 0) &&
      (!restrictions.allowedFiscalYears || restrictions.allowedFiscalYears.length === 0)) {
    return null; // No restrictions, don't show anything
  }

  return (
    <Box sx={{ mb: 2 }}>
      {readOnly && (
        <Alert
          severity="warning"
          icon={<Lock />}
          sx={{ mb: 1 }}
        >
          <Typography variant="body2">
            <strong>Read-Only Mode:</strong> You can view data but cannot make changes.
          </Typography>
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Access Restrictions:
        </Typography>

        {restrictions.allowedBudgetTypes && restrictions.allowedBudgetTypes.length > 0 && (
          <Tooltip title={`Limited to budget types: ${restrictions.allowedBudgetTypes.join(', ')}`}>
            <Chip
              size="small"
              label={`${restrictions.allowedBudgetTypes.length} Budget Type${restrictions.allowedBudgetTypes.length > 1 ? 's' : ''}`}
              color="info"
              variant="outlined"
              icon={<Warning />}
            />
          </Tooltip>
        )}

        {restrictions.allowedFiscalYears && restrictions.allowedFiscalYears.length > 0 && (
          <Tooltip title={`Limited to fiscal years: ${restrictions.allowedFiscalYears.join(', ')}`}>
            <Chip
              size="small"
              label={`${restrictions.allowedFiscalYears.length} Fiscal Year${restrictions.allowedFiscalYears.length > 1 ? 's' : ''}`}
              color="info"
              variant="outlined"
              icon={<Warning />}
            />
          </Tooltip>
        )}

        {!readOnly && (
          <Chip
            size="small"
            label="Full Access"
            color="success"
            variant="outlined"
            icon={<LockOpen />}
          />
        )}
      </Box>
    </Box>
  );
};

/**
 * Higher-order component to wrap restricted content
 */
export const withAccessCheck = (WrappedComponent, options = {}) => {
  return (props) => {
    const { readOnly, canAccessBudgetType, canAccessFiscalYear } = useUserRestrictions();
    const { budgetType, fiscalYear, showIndicator = true } = options;

    // Check if current data is accessible
    const hasAccess = (!budgetType || canAccessBudgetType(budgetType)) &&
                     (!fiscalYear || canAccessFiscalYear(fiscalYear));

    if (!hasAccess) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Alert severity="error" icon={<Lock />}>
            <Typography variant="body2">
              Access denied: You don't have permission to view this data.
            </Typography>
          </Alert>
        </Box>
      );
    }

    return (
      <>
        {showIndicator && <AccessStatusIndicator />}
        <WrappedComponent {...props} readOnly={readOnly} />
      </>
    );
  };
};

/**
 * Hook to get access status for specific data
 */
export const useAccessStatus = (budgetType, fiscalYear) => {
  const { readOnly, canAccessBudgetType, canAccessFiscalYear } = useUserRestrictions();

  const hasAccess = (!budgetType || canAccessBudgetType(budgetType)) &&
                   (!fiscalYear || canAccessFiscalYear(fiscalYear));

  const accessMessage = !hasAccess
    ? "Access denied: Insufficient permissions"
    : readOnly
    ? "Read-only access"
    : "Full access";

  return {
    hasAccess,
    readOnly,
    accessMessage,
    canModify: hasAccess && !readOnly
  };
};