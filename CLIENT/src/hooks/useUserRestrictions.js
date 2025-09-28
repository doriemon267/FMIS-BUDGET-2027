import { useUser } from '../context/UserContext';
import {
  getUserRestrictions,
  isUserReadOnly,
  canAccessBudgetType,
  canAccessFiscalYear,
  getFilteredOptions
} from '../utils/permissions';

/**
 * Custom hook to access user restrictions and permissions
 */
export function useUserRestrictions() {
  const { currentUser } = useUser();

  const restrictions = getUserRestrictions(currentUser);
  const readOnly = isUserReadOnly(currentUser);

  return {
    restrictions,
    readOnly,
    canAccessBudgetType: (budgetType) => canAccessBudgetType(currentUser, budgetType),
    canAccessFiscalYear: (fiscalYear) => canAccessFiscalYear(currentUser, fiscalYear),
    getFilteredOptions: (options, type) => getFilteredOptions(currentUser, options, type),
    // Helper methods
    canCreate: !readOnly,
    canEdit: !readOnly,
    canDelete: !readOnly
  };
}

/**
 * Hook to check if current user has access to specific data
 */
export function useAccessCheck() {
  const { currentUser } = useUser();

  return {
    canAccessData: (budgetType, fiscalYear) => {
      return canAccessBudgetType(currentUser, budgetType) &&
             canAccessFiscalYear(currentUser, fiscalYear);
    },

    canModifyData: (budgetType, fiscalYear) => {
      return !isUserReadOnly(currentUser) &&
             canAccessBudgetType(currentUser, budgetType) &&
             canAccessFiscalYear(currentUser, fiscalYear);
    },

    getAccessMessage: (budgetType, fiscalYear) => {
      const restrictions = getUserRestrictions(currentUser);

      if (isUserReadOnly(currentUser)) {
        return "Account is in read-only mode";
      }

      if (budgetType && !canAccessBudgetType(currentUser, budgetType)) {
        return `Access denied: Budget type '${budgetType}' not allowed`;
      }

      if (fiscalYear && !canAccessFiscalYear(currentUser, fiscalYear)) {
        return `Access denied: Fiscal year '${fiscalYear}' not allowed`;
      }

      return null; // Has access
    }
  };
}