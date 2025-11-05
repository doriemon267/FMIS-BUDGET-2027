# 🎯 Workflow Roles Standardization (November 2025)

## Problem Identified
Inconsistent role naming across the application was causing confusion:
- Sometimes "PREPARER", sometimes "BUDGET PREPARER"
- Sometimes "REVIEWER", sometimes "BUDGET REVIEWER"  
- Sometimes "APPROVER", sometimes "BUDGET APPROVER"
- Mixing of roles causing workflow logic errors

## ✅ STANDARDIZED WORKFLOW ROLES (FINAL)

### Single Unified Workflow Sequence:
```
BUDGET PREPARER → BUDGET REVIEWER → BUDGET APPROVER → BUDGET PLANNING ANALYST → BUDGET OFFICER → OVERALL BUDGET APPROVER
```

### Role Definitions:

| Step | Role Name | Full Name | Description | Permission Level |
|------|-----------|-----------|-------------|------------------|
| 1 | `BUDGET PREPARER` | Budget Preparer | Creates and edits budget proposals | Creates own proposals |
| 2 | `BUDGET REVIEWER` | Budget Reviewer | Reviews proposals for quality assurance | Reviews proposals |
| 3 | `BUDGET APPROVER` | Budget Approver | Approves proposals after review | Approves proposals |
| 4 | `BUDGET_PLANNING_ANALYST` | Budget Planning Analyst | Performs technical analysis of budget proposals | Technical analysis + region-based access |
| 5 | `BUDGET_OFFICER` | Budget Officer | Provides operational approval of proposals | Operational approval |
| 6 | `OVERALL_BUDGET_APPROVER` | Overall Budget Approver | Final executive-level approval authority | Final approval + admin access |

### Special Roles:
- `BUDGET_ADMIN` - Full system administrative access (all permissions)

---

## 📋 Implementation Details

### Frontend Code (`CLIENT/src/components/workflow/WorkflowActions.jsx`)

**Before (INCORRECT)**:
```javascript
const isPreparer = normalizedRoles.includes('PREPARER');
const isApprover = normalizedRoles.includes('APPROVER');
const isBudgetReviewer = normalizedRoles.includes('BUDGET_REVIEWER');
```

**After (CORRECT)**:
```javascript
// Use standardized role names: BUDGET PREPARER → BUDGET REVIEWER → BUDGET APPROVER → etc.
const isPreparer = normalizedRoles.includes('BUDGET_PREPARER') || normalizedRoles.includes('PREPARER');
const isBudgetReviewer = normalizedRoles.includes('BUDGET_REVIEWER') || normalizedRoles.includes('REVIEWER');
const isApprover = normalizedRoles.includes('BUDGET_APPROVER') || normalizedRoles.includes('APPROVER');
const isBudgetPlanningAnalyst = normalizedRoles.includes('BUDGET_PLANNING_ANALYST');
const isBudgetOfficer = normalizedRoles.includes('BUDGET_OFFICER');
const isOverallApprover = normalizedRoles.includes('OVERALL_BUDGET_APPROVER') || normalizedRoles.includes('BUDGET_MANAGER');
const isBudgetAdmin = normalizedRoles.includes('BUDGET_ADMIN');
```

### Role Normalization Map (`CLIENT/src/components/workflow/WorkflowActions.jsx`)

The `normalizeRoleValue()` function now maps ALL role synonyms to the standardized names:

**BUDGET PREPARER Group**:
- PREPARER → BUDGET_PREPARER
- ANALYST → BUDGET_PREPARER
- BA → BUDGET_PREPARER
- BUDGET_PREPARER → BUDGET_PREPARER

**BUDGET REVIEWER Group**:
- REVIEWER → BUDGET_REVIEWER
- BUDGET_REVIEWER → BUDGET_REVIEWER
- BUDGETREVIEWER → BUDGET_REVIEWER
- DIVISION_REVIEWER → BUDGET_REVIEWER
- REV → BUDGET_REVIEWER

**BUDGET APPROVER Group**:
- APPROVER → BUDGET_APPROVER
- BUDGET_APPROVER → BUDGET_APPROVER
- DIVISION_APPROVER → BUDGET_APPROVER
- OFFICE_APPROVER → BUDGET_APPROVER
- DIVISIONAPPROVER → BUDGET_APPROVER
- DIVISION_VERIFIER → BUDGET_APPROVER

**BUDGET PLANNING ANALYST**:
- BUDGET_PLANNING_ANALYST → BUDGET_PLANNING_ANALYST
- PLANNING_ANALYST → BUDGET_PLANNING_ANALYST
- BUDGETANALYST → BUDGET_PLANNING_ANALYST

**BUDGET OFFICER**:
- BUDGET_OFFICER → BUDGET_OFFICER
- OFFICER → BUDGET_OFFICER
- OFFICE_CONSOLIDATOR → BUDGET_OFFICER
- OFFICE_VERIFIER → BUDGET_OFFICER
- BUDGET_SPECIALIST → BUDGET_OFFICER

**OVERALL BUDGET APPROVER**:
- OVERALL_BUDGET_APPROVER → OVERALL_BUDGET_APPROVER
- BUDGET_MANAGER → OVERALL_BUDGET_APPROVER
- OVERALL_APPROVER → OVERALL_BUDGET_APPROVER
- REGION_FINAL_VERIFIER → OVERALL_BUDGET_APPROVER
- FINAL_APPROVER → OVERALL_BUDGET_APPROVER
- FULL → OVERALL_BUDGET_APPROVER

---

## 🔄 Migration Guidelines

### For Existing Code:
1. Replace all hardcoded role checks with the standardized names
2. Always use the full form: `BUDGET PREPARER`, not `PREPARER`
3. Use the normalization function for any external role values

### For Role Constants:
- **Frontend**: Use `WORKFLOW_ROLES` from `CLIENT/src/constants/workflowConstants.js`
- **Backend**: Use `WORKFLOW_ROLES` from `SERVER/constants/workflowConstants.js`

### For User Role Assignments:
When assigning roles to users in `HierarchicalUserAssignmentPage.jsx`, use the full standardized names from `USER_ROLES` constant.

---

## ✅ Files Updated

1. **`CLIENT/src/components/workflow/WorkflowActions.jsx`**
   - Updated role checking logic (lines 255-261)
   - Updated role normalization map (lines 117-177)
   - Now maps all role synonyms to BUDGET_* standardized names

2. **`CLIENT/src/pages/HierarchicalUserAssignmentPage.jsx`** (Already correct)
   - `USER_ROLES` constant has proper full names
   - Region assignment fields added for BUDGET_PLANNING_ANALYST

3. **`CLIENT/src/constants/workflowConstants.js`** (Already correct)
   - `WORKFLOW_ROLES` has standardized names
   - `WORKFLOW_STEPS` array shows correct 6-step sequence

---

## 🧪 Testing Checklist

- [ ] User with BUDGET PREPARER role can create proposals
- [ ] User with BUDGET REVIEWER role can review proposals
- [ ] User with BUDGET APPROVER role can approve proposals
- [ ] User with BUDGET_PLANNING_ANALYST role can perform analysis
- [ ] User with BUDGET_OFFICER role can approve operationally
- [ ] User with OVERALL_BUDGET_APPROVER role has final approval
- [ ] User with BUDGET_ADMIN role has full access
- [ ] Workflow actions respect role hierarchy
- [ ] Region selection works for BUDGET_PLANNING_ANALYST
- [ ] Region display shows correctly when editing assignments

---

## 📝 Notes

- **Backward Compatibility**: The normalization function maintains backward compatibility with old role names
- **Database**: Existing database entries with old role names will be automatically normalized
- **Role Hierarchy**: Higher roles do not automatically inherit lower role actions; each role must be explicitly granted permissions
- **NIA-Wide vs Region**: BUDGET_PLANNING_ANALYST can have either NIA-Wide access or specific region assignment

---

**Status**: ✅ COMPLETE - All role naming now follows the standardized workflow: BUDGET PREPARER → BUDGET REVIEWER → BUDGET APPROVER → BUDGET PLANNING ANALYST → BUDGET OFFICER → OVERALL BUDGET APPROVER
