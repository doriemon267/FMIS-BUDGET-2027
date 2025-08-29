# 🔧 API Cleanup and Naming Standardization Plan

## Current Issues to Fix:

### 1. Inconsistent Naming Conventions
- `RATARoutes.js` → `rataRoutes.js`
- `BudgetManagerOrgRoutes.js` → `budgetManagerOrgRoutes.js`
- `RegionRoutes.js` → `regionRoutes.js`
- `COSPersonnel_router.js` → `cosPersonnelRoutes.js`
- `SpecialCounselAllowanceRoutes.js` → `specialCounselAllowanceRoutes.js`
- `EmployeeList_router.js` → `employeeListRoutes.js`
- `employee_master_router.js` → `employeeMasterRoutes.js`
- `AccountingEntryList_router.js` → `accountingEntryListRoutes.js`
- `Salary_router.js` → `salaryRoutes.js`
- `loyaltyPay_router.js` → `loyaltyPayRoutes.js`
- `personnelServices_router.js` → `personnelServicesRoutes.js`
- `personnel_params_router.js` → `personnelParamsRoutes.js`
- `income_category_router.js` → `incomeCategoryRoutes.js`
- `income_subcategory_router.js` → `incomeSubcategoryRoutes.js`
- `test_router.js` → `testRoutes.js`

### 2. Duplicate Files to Remove
- `chartOfAccountsRoutes_fixed.js` (keep `chartOfAccountsRoutes.js`)
- `personnelServices_router_simplified.js` (keep main one)
- `Salary_router_fixed.js` (keep `Salary_router.js` then rename)

### 3. Inconsistent File Extensions and Patterns
- Some use `.js`, others have mixed patterns
- Some have underscores, others use camelCase

### 4. Route Path Syntax Issues
- Missing `/` in some setupRoutes paths
- Inconsistent path patterns

## Implementation Steps:

1. **Phase 1**: Rename files to follow camelCase convention
2. **Phase 2**: Update all import statements in index.js and other files
3. **Phase 3**: Remove duplicate files
4. **Phase 4**: Fix syntax issues in route definitions
5. **Phase 5**: Update any remaining references

## Expected Benefits:
- Consistent naming throughout the project
- Easier navigation and maintenance
- Cleaner codebase
- Better developer experience
- Professional code standards
