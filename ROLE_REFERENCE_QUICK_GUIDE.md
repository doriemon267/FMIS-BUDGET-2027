# 🎯 QUICK ROLE REFERENCE

## The Standardized Workflow (FINAL & OFFICIAL)

```
BUDGET PREPARER 
    ↓
BUDGET REVIEWER 
    ↓
BUDGET APPROVER 
    ↓
BUDGET PLANNING ANALYST 
    ↓
BUDGET OFFICER 
    ↓
OVERALL BUDGET APPROVER
```

---

## ✅ DO's and DON'Ts

### ✅ DO USE
- `'BUDGET PREPARER'` ✓
- `'BUDGET REVIEWER'` ✓
- `'BUDGET APPROVER'` ✓
- `'BUDGET_PLANNING_ANALYST'` ✓
- `'BUDGET_OFFICER'` ✓
- `'OVERALL_BUDGET_APPROVER'` ✓
- `'BUDGET_ADMIN'` ✓

### ❌ DON'T USE (DEPRECATED)
- `'PREPARER'` ❌ → Use `'BUDGET PREPARER'`
- `'REVIEWER'` ❌ → Use `'BUDGET REVIEWER'`
- `'APPROVER'` ❌ → Use `'BUDGET APPROVER'`
- `'BUDGET_MANAGER'` ❌ → Use `'OVERALL_BUDGET_APPROVER'`
- `'BUDGET MANAGER'` ❌ → Use `'OVERALL_BUDGET_APPROVER'`

---

## 📝 Role Checking Code Examples

### Frontend Role Checks
```javascript
// ✅ CORRECT
const isPreparer = normalizedRoles.includes('BUDGET_PREPARER');
const isReviewer = normalizedRoles.includes('BUDGET_REVIEWER');
const isApprover = normalizedRoles.includes('BUDGET_APPROVER');
const isAnalyst = normalizedRoles.includes('BUDGET_PLANNING_ANALYST');
const isOfficer = normalizedRoles.includes('BUDGET_OFFICER');
const isOverallApprover = normalizedRoles.includes('OVERALL_BUDGET_APPROVER');
```

### HierarchicalUserAssignmentPage Role List
```javascript
// ✅ CORRECT - from USER_ROLES constant
const USER_ROLES = [
  { value: 'BUDGET PREPARER', label: 'Budget Preparer', ... },
  { value: 'BUDGET REVIEWER', label: 'Budget Reviewer', ... },
  { value: 'BUDGET APPROVER', label: 'Budget Approver', ... },
  { value: 'BUDGET_PLANNING_ANALYST', label: 'Budget Planning Analyst', ... },
  { value: 'BUDGET_OFFICER', label: 'Budget Officer', ... },
  { value: 'OVERALL_BUDGET_APPROVER', label: 'Overall Budget Approver', ... },
  { value: 'BUDGET_ADMIN', label: 'Budget Admin', ... }
];
```

---

## 🔧 Role Normalization

The system automatically normalizes role names using the `normalizeRoleValue()` function in `WorkflowActions.jsx`.

**Examples**:
- `'PREPARER'` → normalized to `'BUDGET_PREPARER'`
- `'REVIEWER'` → normalized to `'BUDGET_REVIEWER'`
- `'APPROVER'` → normalized to `'BUDGET_APPROVER'`
- `'ANALYST'` → normalized to `'BUDGET_PREPARER'`
- `'OFFICER'` → normalized to `'BUDGET_OFFICER'`
- `'BUDGET_MANAGER'` → normalized to `'OVERALL_BUDGET_APPROVER'`

This means old code using short names will still work, but new code should use the full standardized names.

---

## 📊 Permission Hierarchy

| Level | Can Create | Can Review | Can Approve | Can Analyze | Can Operate | Can Executive | Can Admin |
|-------|-----------|-----------|-----------|-----------|-----------|--------------|----------|
| BUDGET PREPARER | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| BUDGET REVIEWER | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| BUDGET APPROVER | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| BUDGET PLANNING ANALYST | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| BUDGET OFFICER | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| OVERALL BUDGET APPROVER | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| BUDGET ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 🌍 BUDGET_PLANNING_ANALYST - Region Access

BUDGET_PLANNING_ANALYST role has special region-based access control:

### Option 1: NIA-Wide Access
- Can see all proposals from all regions
- `isNIAWide: true`
- `assignedRegions: []` (empty)

### Option 2: Specific Regions Only
- Can see proposals only from assigned regions
- `isNIAWide: false`
- `assignedRegions: ['REGION I', 'MARIIS', 'CALABARZON', ...]`

---

## ✅ Status: COMPLETE
All role naming is now standardized across the entire application.
