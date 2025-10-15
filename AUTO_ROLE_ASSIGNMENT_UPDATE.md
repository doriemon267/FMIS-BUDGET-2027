# Auto Role Assignment Update - October 2025

## Overview
Updated the Hierarchical User Assignment system to automatically assign correct workflow roles based on the user's **Budget Role** (userRole) instead of just assignment level.

## Problem Solved
Previously, the system auto-assigned creator roles to ALL users regardless of their actual job function, causing role conflicts where coordinators, officers, and managers had creator roles they shouldn't have.

## New Auto-Assignment Logic

### Based on User Role (userRole parameter)

| User Role | Auto-Assigned Workflow Roles | Description |
|-----------|------------------------------|-------------|
| **BUDGET_ANALYST** | `divisionCreator` (RC level) OR `officeCreator` (Office level) | Creates and prepares budget proposals |
| **BUDGET_COORDINATOR** | `divisionApprover` | Reviews and approves division-level proposals |
| **BUDGET_OFFICER** | `officeConsolidator`, `officeFinalVerifier` | Verifies and consolidates proposals |
| **BUDGET_MANAGER** | `managerapprover`, `regionFinalVerifier` | Final approval authority |
| **BUDGET_ADMIN** | All workflow roles | Full administrative access |

### Assignment Level Still Matters for BUDGET_ANALYST

- **RESPONSIBILITY_CENTER Level** → `divisionCreator`
  - Submits to BUDGET COORDINATOR → BUDGET OFFICER → BUDGET MANAGER
  
- **OFFICE Level** → `officeCreator`
  - Submits DIRECTLY to BUDGET OFFICER (skips coordinator)

## Files Updated

### Backend
**SERVER/controllers/UserOrganizationalAssignmentController.js**
- Added `userRole` parameter extraction from request body
- Updated auto-assignment logic to check `userRole` first
- Falls back to old logic if `userRole` not specified (backward compatibility)
- Lines 113-147: Complete rewrite of workflow role auto-assignment

### Frontend
**CLIENT/src/pages/HierarchicalUserAssignmentPage.jsx**
- Updated `USER_ROLES` dropdown descriptions
- Added `workflowRoles` field to each role definition showing what will be auto-assigned
- Lines 56-78: Updated USER_ROLES constant

## How It Works

### Creating New User Assignment

1. Admin selects user from FMIS-MAIN system
2. Admin selects **Budget Role** from dropdown:
   - Budget Analyst
   - Budget Coordinator
   - Budget Officer
   - Budget Manager
   - Budget Admin

3. Admin selects **Assignment Level**:
   - Responsibility Center (RC/Division)
   - Office (Department)
   - Full (Admin/Manager access)

4. System auto-assigns workflow roles based on combination:

**Example 1: Budget Analyst at RC Level**
```javascript
userRole: 'BUDGET_ANALYST'
accessScope: 'RESPONSIBILITY_CENTER'
→ Auto-assigns: ['divisionCreator']
```

**Example 2: Budget Coordinator**
```javascript
userRole: 'BUDGET_COORDINATOR'
accessScope: 'RESPONSIBILITY_CENTER' // or any level
→ Auto-assigns: ['divisionApprover']
```

**Example 3: Budget Officer**
```javascript
userRole: 'BUDGET_OFFICER'
accessScope: 'OFFICE'
→ Auto-assigns: ['officeConsolidator', 'officeFinalVerifier']
```

## Migration Already Completed

Fixed existing users with conflicting roles:
- Joshua Demafelez → BUDGET_ANALYST (divisionCreator)
- Nelson Eloso → BUDGET_COORDINATOR (divisionApprover)
- Andrie Barrameda → BUDGET_OFFICER (officeConsolidator, officeFinalVerifier)
- Reymund Edra → BUDGET_MANAGER (FULL access)

See: `fix-user-roles.js` and `migrate-workflow-role-separation.js`

## Testing

After this update, when you create or update a user assignment:

1. ✅ **Budget Analysts** get creator roles ONLY
2. ✅ **Budget Coordinators** get approver roles ONLY (no creator)
3. ✅ **Budget Officers** get verifier/consolidator roles ONLY (no creator)
4. ✅ **Budget Managers** get final approval roles ONLY (no creator)
5. ✅ **Budget Admins** get ALL roles (full access)

## Backward Compatibility

If `userRole` is not provided, system falls back to old logic:
- RC Level → divisionCreator
- Office Level → officeCreator
- Full Level → officeCreator + officeFinalVerifier + regionFinalVerifier

This ensures old API calls still work while new assignments use the improved logic.

## Next Steps

1. Clear browser cache and re-login to see updated roles
2. Test creating new user assignments with different role combinations
3. Verify workflow paths work correctly for each role type

---
**Date:** October 15, 2025
**Status:** ✅ Complete and Deployed
