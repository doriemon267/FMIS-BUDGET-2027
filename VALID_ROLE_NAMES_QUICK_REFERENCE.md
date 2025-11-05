# ✅ VALID ROLE NAMES - QUICK REFERENCE

## 🎯 The ONLY 9 Valid Roles

### 👨‍💼 Admin Roles (3)
```
SUPER_ADMIN
ADMIN
BUDGET_ADMIN
```

### 📊 6-Step Workflow Roles (6)
```
STEP 1: BUDGET_PREPARER
STEP 2: BUDGET_REVIEWER
STEP 3: BUDGET_APPROVER
STEP 4: BUDGET_PLANNING_ANALYST
STEP 5: BUDGET_OFFICER
STEP 6: OVERALL_BUDGET_APPROVER
```

---

## ❌ INVALID - DO NOT USE

### Old Short Names (REMOVED)
- ❌ PREPARER → use **BUDGET_PREPARER**
- ❌ REVIEWER → use **BUDGET_REVIEWER**
- ❌ APPROVER → use **BUDGET_APPROVER**

### Other Invalid Names (REMOVED)
- ❌ PREPARER
- ❌ REVIEWER
- ❌ APPROVER
- ❌ SUPERVISOR
- ❌ DEPARTMENT_HEAD
- ❌ BUDGET_MANAGER
- ❌ BUDGET_COORDINATOR
- ❌ SENIOR_STAFF
- ❌ STAFF
- ❌ BUDGET_ANALYST (old name)
- ❌ OFFICE APPROVER
- ❌ DIVISION APPROVER
- ❌ And all internal workflow roles like: divisionCreator, regionCreator, officeConsolidator, etc.

---

## ✅ Where These Are Used

**HierarchicalUserAssignmentController.js**:
- `lookupUserFromMainDB()` - role determination
- `createOrUpdateHierarchicalAssignment()` - validation
- `updateWorkflowRoles()` - workflow role updates
- `applyOfficeDefaults()` - role mapping

---

## 📝 API Error Example

**If you send an invalid role:**

```json
{
  "success": false,
  "message": "Invalid workflowRoles: REVIEWER, PREPARER. Only use: SUPER_ADMIN, ADMIN, BUDGET_ADMIN, BUDGET_PREPARER, BUDGET_REVIEWER, BUDGET_APPROVER, BUDGET_PLANNING_ANALYST, BUDGET_OFFICER, OVERALL_BUDGET_APPROVER",
  "code": "INVALID_WORKFLOW_ROLES"
}
```

---

## 🔄 Migration Guide

If you have existing data with old role names:

| Old Name | New Name |
|----------|----------|
| PREPARER | BUDGET_PREPARER |
| REVIEWER | BUDGET_REVIEWER |
| APPROVER | BUDGET_APPROVER |
| BUDGET_ANALYST | BUDGET_PLANNING_ANALYST |
| SUPERVISOR | BUDGET_OFFICER |
| BUDGET_MANAGER | OVERALL_BUDGET_APPROVER |

---

✅ **Status**: ALL role names standardized in backend controller
