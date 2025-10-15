# Hierarchical User Assignment - Workflow Role Updates

## Changes Made (October 15, 2025)

### Background
Previous auto-assignment logic incorrectly assigned BOTH creator and approver roles to the same user, violating separation of duties principle.

### Updated Auto-Assignment Rules

#### 1. UserOrganizationalAssignmentController.js

**BEFORE (INCORRECT)**:
```javascript
// RESPONSIBILITY_CENTER level
autoAssignedWorkflowRoles.push('divisionCreator', 'divisionApprover'); // ❌ Both roles!

// OFFICE level  
autoAssignedWorkflowRoles.push('officeCreator', 'officeApprover'); // ❌ Both roles!
```

**AFTER (CORRECT)**:
```javascript
// RESPONSIBILITY_CENTER level
autoAssignedWorkflowRoles.push('divisionCreator'); // ✅ Creator only

// OFFICE level
autoAssignedWorkflowRoles.push('officeCreator'); // ✅ Creator only
```

#### 2. workflowRoleManager.js

Updated `assignWorkflowRoles()` function to:
- Auto-assign CREATOR roles only by default
- Added comprehensive documentation about workflow hierarchy
- Updated switch cases to reflect new workflow paths

**Key Changes**:
- `RESPONSIBILITY_CENTER` / `DIVISION` → auto-assign `divisionCreator` only
- `OFFICE` → auto-assign `officeCreator` only
- `DEPARTMENT` → auto-assign `departmentConsolidator` (coordinator level)
- `REGION` → auto-assign `regionFinalVerifier` (manager level)
- `FULL` → all roles (admin)

### Workflow Role Definitions

| Role | Function | Auto-Assigned When | Manual Assignment Required |
|------|----------|-------------------|----------------------------|
| `divisionCreator` | Budget Analyst (RC/Division) | accessScope = RC | No |
| `officecreator` | Budget Analyst (Office) | accessScope = OFFICE | No |
| `divisionapprover` | Budget Coordinator | Never auto-assigned | ✅ YES |
| `officeverifier` | Budget Officer | Never auto-assigned | ✅ YES |
| `officeconsolidator` | Budget Officer | Never auto-assigned | ✅ YES |
| `officefinalverifier` | Budget Officer | Only if FULL access | Usually manual |
| `managerapprover` | Budget Manager | Only if FULL access | Usually manual |
| `regionfinalverifier` | Budget Manager | accessScope = REGION or FULL | Sometimes |

### How to Assign Users

#### Budget Analyst (Creator)
```javascript
// Division/RC Level
POST /api/hierarchical-rbac/assign
{
  "userId": "12345",
  "accessScope": "RESPONSIBILITY_CENTER",
  "officeId": "...",
  "responsibilityCenterName": "..."
  // workflowRoles will auto-assign: ['divisionCreator']
}

// Office Level
POST /api/hierarchical-rbac/assign
{
  "userId": "12345",
  "accessScope": "OFFICE",
  "officeId": "..."
  // workflowRoles will auto-assign: ['officeCreator']
}
```

#### Budget Coordinator (Approver)
```javascript
POST /api/hierarchical-rbac/assign
{
  "userId": "67890",
  "accessScope": "DEPARTMENT",
  "departmentId": "...",
  "workflowRoles": ["divisionapprover"] // ✅ MUST manually specify
}
```

#### Budget Officer (Verifier)
```javascript
POST /api/hierarchical-rbac/assign
{
  "userId": "11111",
  "accessScope": "OFFICE",
  "officeId": "...",
  "workflowRoles": ["officeverifier", "officeconsolidator"] // ✅ MUST manually specify
}
```

#### Budget Manager (Final Approver)
```javascript
POST /api/hierarchical-rbac/assign
{
  "userId": "22222",
  "accessScope": "REGION",
  "regionId": "...",
  "workflowRoles": ["managerapprover", "regionfinalverifier"] // Usually auto-assigned at REGION level
}
```

### Migration Required

Run the migration script to fix existing users with conflicting roles:

```bash
cd SERVER
node migrate-workflow-role-separation.js
```

**What it does**:
1. Finds users with BOTH creator and approver roles
2. Removes approver roles, keeps creator roles
3. Logs affected users for manual review

**After migration**:
- Review the logged users
- Manually assign appropriate approver roles to users who are legitimately coordinators/officers/managers

### Files Modified

1. `SERVER/controllers/UserOrganizationalAssignmentController.js`
   - Updated auto-assignment logic (lines 108-130)
   - Added comprehensive comments explaining new rules

2. `SERVER/helpers/workflowRoleManager.js`
   - Updated `assignWorkflowRoles()` function
   - Added workflow hierarchy documentation
   - Updated switch cases for each assignment level

3. `SERVER/migrate-workflow-role-separation.js` (NEW)
   - Migration script to fix existing assignments

4. `WORKFLOW_ROLES_CLARIFICATION.md`
   - Comprehensive workflow documentation

5. `CLIENT/src/components/myproposal/ProposalDetailsDialog.jsx`
   - Updated role detection to include `officecreator`
   - Added `isOfficeCreator` flag

### Testing Recommendations

1. **Create new Budget Analyst (RC level)**:
   - Verify auto-assigned role is `divisionCreator` only
   - Verify they can create and submit proposals
   - Verify proposal goes to COORDINATOR first

2. **Create new Budget Analyst (Office level)**:
   - Verify auto-assigned role is `officeCreator` only
   - Verify they can create and submit proposals
   - Verify proposal goes DIRECTLY to OFFICER (skip coordinator)

3. **Create new Budget Coordinator**:
   - Manually assign `divisionapprover` role
   - Verify they can ONLY review/approve, NOT create
   - Verify they receive division-level proposals

4. **Create new Budget Officer**:
   - Manually assign `officeverifier` or `officeconsolidator` role
   - Verify they can ONLY verify/approve, NOT create
   - Verify they receive proposals from coordinators AND office-level analysts

### Important Notes

- ⚠️ **Separation of Duties**: Users should EITHER be creators OR approvers, not both
- ⚠️ **Manual Assignment**: Coordinator, Officer, and Manager roles MUST be manually assigned
- ⚠️ **Existing Users**: Run migration script to fix users with conflicting roles
- ⚠️ **Workflow Paths**: Office-level analysts skip coordinator and go directly to officer

---

## Date: October 15, 2025
