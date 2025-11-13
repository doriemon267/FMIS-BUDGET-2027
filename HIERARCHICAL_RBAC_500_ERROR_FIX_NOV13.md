# Hierarchical RBAC 500 Error Fix - November 13, 2025

## Problem Summary
The POST endpoint `http://localhost:5005/api/hierarchical-rbac/assignments` was returning HTTP 500 errors when attempting to save hierarchical user assignments.

**Error Details:**
```
POST http://localhost:5005/api/hierarchical-rbac/assignments 500 (Internal Server Error)
Error saving assignment: AxiosError {message: 'Request failed with status code 500', ...}
```

## Root Cause
**Schema Validation Error: Inconsistent Role Name Format**

The MongoDB schema for `HierarchicalUserAssignment.userRole` enum had mixed formats:
- Some roles used **spaces**: `'BUDGET PREPARER'`, `'BUDGET REVIEWER'`, `'BUDGET APPROVER'`
- Some roles used **underscores**: `'BUDGET_PLANNING_ANALYST'`, `'BUDGET_OFFICER'`, `'OVERALL_BUDGET_APPROVER'`

The client was sending role names with **underscores** (standardized format), but the schema only accepted the space-separated format for some roles. This caused Mongoose validation to fail with a 500 error on the server.

Additionally, the `workflowRoles` enum in the same model had similar inconsistencies.

## Files Modified

### 1. **SERVER/models/HierarchicalUserAssignment.js**
   - **Updated `userRole` enum field** (lines 20-34)
     - Standardized all 6-step workflow roles to use underscores
     - Added missing admin role variants
     - **Before:** `'BUDGET PREPARER'`, `'BUDGET REVIEWER'`, `'BUDGET_PLANNING_ANALYST'` (mixed)
     - **After:** `'BUDGET_PREPARER'`, `'BUDGET_REVIEWER'`, `'BUDGET_PLANNING_ANALYST'` (all underscores)
   
   - **Updated `workflowRoles` enum field** (lines 108-123)
     - Changed user-facing role names to use underscores: `'BUDGET_PREPARER'` instead of `'BUDGET PREPARER'`

### 2. **CLIENT/src/pages/HierarchicalUserAssignmentPage.jsx**
   - **Updated USER_ROLES array** (lines 55-99)
     - Changed all role values from space format to underscore format
     - `'BUDGET PREPARER'` → `'BUDGET_PREPARER'`
     - `'BUDGET REVIEWER'` → `'BUDGET_REVIEWER'`
     - `'BUDGET APPROVER'` → `'BUDGET_APPROVER'`
     - `'BUDGET PLANNING ANALYST'` → `'BUDGET_PLANNING_ANALYST'`
     - `'BUDGET OFFICER'` → `'BUDGET_OFFICER'`
     - `'BUDGET MANAGER'` → `'OVERALL_BUDGET_APPROVER'` (corrected name)
     - `'SUPER ADMIN'` → `'SUPER_ADMIN'`
   
   - **Updated current user role checks** (lines 281-284)
     - Now checks for underscore format: `'BUDGET_PREPARER'` etc.
   
   - **Updated dynamic role assignment throughout:**
     - Line 403: Default role assignment
     - Line 407, 653: Budget Planning Analyst checks
     - Line 420: Budget Approver checks
     - Line 607: Budget Planning Analyst validation
     - Line 871: Lookup data default
     - Lines 975-981: Role permission setting
     - Line 1031: Form conditional rendering
     - Lines 1219, 1242, 1266: Default role assignments

### 3. **SERVER/controllers/HierarchicalUserAssignmentController.js**
   - **Updated `lookupUserFromMainDB` function** (lines 100-130)
     - Maintains backward compatibility by accepting both space and underscore formats from the database
     - Always returns standardized underscore format to client
   
   - **Updated `getAllHierarchicalAssignments` function** (lines 540-548)
     - Checks for both old (space) and new (underscore) formats for backward compatibility
     - Ensures proper access control across all role naming conventions

## Standardized Role Names (CONSISTENT ACROSS CLIENT & SERVER)

### 6-Step Workflow Roles (Standardized with Underscores)
```javascript
'BUDGET_PREPARER'           // STEP 1: Creates draft proposals
'BUDGET_REVIEWER'           // STEP 2: Reviews and approves/rejects
'BUDGET_APPROVER'           // STEP 3: Approves and forwards to analyst
'BUDGET_PLANNING_ANALYST'   // STEP 4: Analyzes and forwards to officer
'BUDGET_OFFICER'            // STEP 5: Makes final budget decisions
'OVERALL_BUDGET_APPROVER'   // STEP 6: Final approval (formerly BUDGET_MANAGER)
```

### Admin Roles
```javascript
'SUPER_ADMIN'               // Full administrative access
'ADMIN'                     // Administrative access
'BUDGET_ADMIN'              // Budget-specific admin
```

## Backward Compatibility

The server-side code now handles **both** naming conventions when looking up users from the database:
- Accepts incoming roles with spaces (legacy) or underscores (new)
- Always normalizes and returns underscore format to the client
- This prevents breaking existing data while enforcing consistency

## Testing Recommendations

1. **Test hierarchical assignment creation:**
   ```
   POST /api/hierarchical-rbac/assignments
   Payload: {
     userId: "test-user",
     userName: "Test User",
     email: "test@example.com",
     userRole: "BUDGET_PLANNING_ANALYST",  // ← Use underscore format
     assignmentLevel: "RESPONSIBILITY_CENTER",
     departmentId: "..."
   }
   ```

2. **Verify role assignment for all roles:**
   - BUDGET_PREPARER
   - BUDGET_REVIEWER
   - BUDGET_APPROVER
   - BUDGET_PLANNING_ANALYST
   - BUDGET_OFFICER
   - OVERALL_BUDGET_APPROVER
   - SUPER_ADMIN

3. **Test Budget Planning Analyst region configuration:**
   - Verify `isNIAWide` flag works
   - Verify `assignedRegions` array is properly saved

4. **Verify user lookup endpoint:**
   - `/api/hierarchical-rbac/user-lookup/{userId}` should return `budgetRole` in underscore format

## Error Prevention

The 500 error should no longer occur because:
1. ✅ Schema enum values are now consistent (all underscores)
2. ✅ Client sends role names in underscore format
3. ✅ Server accepts and validates role names correctly
4. ✅ Backward compatibility maintained for legacy data

## Related Documentation
- See `/SERVER/models/HierarchicalUserAssignment.js` for complete schema
- See `/SERVER/controllers/HierarchicalUserAssignmentController.js` for controller logic
- See `/CLIENT/src/pages/HierarchicalUserAssignmentPage.jsx` for UI implementation

---
**Status:** ✅ FIXED  
**Date:** November 13, 2025  
**Affected Endpoint:** `POST /api/hierarchical-rbac/assignments`
