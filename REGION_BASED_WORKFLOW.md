# 📍 Region-Based Workflow Implementation (November 4, 2025)

## Overview

The workflow now enforces region-based access control at the BUDGET_PLANNING_ANALYST step, following this sequence:

```
BUDGET PREPARER (REGION: e.g., MARIIS)
    ↓ 
BUDGET REVIEWER (REGION: MARIIS)
    ↓ 
BUDGET APPROVER (REGION: MARIIS)
    ↓ 
BUDGET_PLANNING_ANALYST (REGION: MARIIS or NIA-Wide)
    ├─ If assigned to MARIIS: Can only see MARIIS proposals
    └─ If assigned NIA-Wide: Can see all regions' proposals
    ↓ 
BUDGET_OFFICER (All regions)
    ↓ 
OVERALL_BUDGET_APPROVER (All regions)
```

---

## How It Works

### 1. Region Assignment (Hierarchical User Assignments)

When creating or editing a **BUDGET_PLANNING_ANALYST** user assignment:

```
Role: BUDGET_PLANNING_ANALYST
Assignment Level: RESPONSIBILITY_CENTER

NIA-Wide Option:
  ○ NIA-Wide / All Regions  → isNIAWide: true,  assignedRegions: []
  ● Specific Regions         → isNIAWide: false, assignedRegions: ['MARIIS', 'REGION I', ...]
```

### 2. Region Filtering in Middleware

The `budgetRoleVisibilityControl` middleware now filters proposals for BUDGET_PLANNING_ANALYST based on their region assignment:

**File**: `SERVER/middleware/budgetRoleVisibilityControl.js`

#### NIA-Wide Access
```javascript
if (isNIAWide) {
  // Can see proposals from ALL regions
  visibilityFilter = { $or: analystVisibilityOptions };
}
```

#### Specific Region Access
```javascript
else if (assignedRegions && assignedRegions.length > 0) {
  // Can only see proposals from assigned regions
  visibilityFilter = {
    $and: [
      { region: { $in: assignedRegions } },  // Must match assigned regions
      { $or: analystVisibilityOptions }      // And workflow visibility rules
    ]
  };
}
```

---

## Data Flow

### When BUDGET PREPARER Creates/Submits Proposal

1. **User**: BUDGET PREPARER (works in MARIIS region)
2. **Proposal** is created with:
   - `region: 'MARIIS'`
   - `createdByUserId: preparerId`
   - Status: `'Draft'` → `'Division Submitted'` → `'Forwarded to Approver'`

### When BUDGET APPROVER Reviews/Approves

1. **User**: BUDGET APPROVER (same region: MARIIS)
2. **Visibility**: Can see proposal because:
   - `currentAssigneeRole: 'BUDGET APPROVER'` OR
   - `division` matches user's division
3. **Action**: Approves and forwards to BUDGET_PLANNING_ANALYST
4. **Proposal Status**: `'Forwarded to Analyst'`

### When BUDGET_PLANNING_ANALYST Analyzes

1. **User**: BUDGET_PLANNING_ANALYST assigned to:
   - Option A: `isNIAWide: true` → Can see ALL proposals
   - Option B: `assignedRegions: ['MARIIS']` → Can see ONLY MARIIS proposals

2. **Query Executed**:
   ```javascript
   // If NIA-Wide
   db.proposals.find({
     $or: [
       { currentAssigneeRole: 'BUDGET_PLANNING_ANALYST' },
       { status: 'Forwarded to Analyst' },
       { createdByUserId: analystId },
       // ... other visibility rules
     ]
   })
   
   // If Specific Regions (MARIIS only)
   db.proposals.find({
     $and: [
       { region: { $in: ['MARIIS'] } },
       { $or: [ /* visibility rules */ ] }
     ]
   })
   ```

3. **Result**: Only proposals matching region filter are shown

### When BUDGET_OFFICER Reviews

1. **User**: BUDGET_OFFICER
2. **Region Filtering**: NO region restriction - can see ALL proposals
3. **Visibility**: Proposals in states:
   - `'Forwarded to Officer'`
   - `'Officer Approved'`
   - `'Forwarded to Manager'`
   - `'Finalized'`

---

## Implementation Details

### Backend Changes

#### File: `SERVER/middleware/budgetRoleVisibilityControl.js` (Lines 62-126)

**What Changed**:
- Added extraction of `isNIAWide` and `assignedRegions` from hierarchical assignment
- Added region filtering logic for BUDGET_PLANNING_ANALYST role
- Implemented conditional filtering based on NIA-Wide vs specific regions
- Added comprehensive logging for debugging

**New Logic**:
```javascript
const isNIAWide = hierarchicalAssignment.isNIAWide === true;
const assignedRegions = hierarchicalAssignment.assignedRegions || [];

if (isNIAWide) {
  // NIA-Wide: Show all proposals matching visibility rules
  visibilityFilter = { $or: analystVisibilityOptions };
} else if (assignedRegions && assignedRegions.length > 0) {
  // Specific regions: Filter by region AND visibility rules
  visibilityFilter = {
    $and: [
      { region: { $in: assignedRegions } },
      { $or: analystVisibilityOptions }
    ]
  };
} else {
  // No assignment: Show nothing for safety
  visibilityFilter = { _id: null };
}
```

### Frontend Features

**File**: `CLIENT/src/pages/HierarchicalUserAssignmentPage.jsx`

Already implemented:
- ✅ Region selection UI (two-button toggle)
- ✅ Multi-select autocomplete for regions
- ✅ Region deduplication
- ✅ Form validation (requires regions if not NIA-Wide)
- ✅ Display of assigned regions when editing

---

## Testing Scenarios

### Scenario 1: NIA-Wide BUDGET_PLANNING_ANALYST
1. Create BUDGET_PLANNING_ANALYST with `isNIAWide: true`
2. Submit proposals from multiple regions (MARIIS, CALABARZON, REGION I)
3. BUDGET_PLANNING_ANALYST should see ALL proposals

**Expected Result**: ✅ All proposals from all regions visible

### Scenario 2: Region-Specific BUDGET_PLANNING_ANALYST
1. Create BUDGET_PLANNING_ANALYST assigned to ['MARIIS', 'CALABARZON']
2. Submit proposals:
   - MARIIS region (should be visible)
   - CALABARZON region (should be visible)
   - REGION I (should NOT be visible)

**Expected Result**: ✅ Only MARIIS and CALABARZON proposals visible

### Scenario 3: Complete Workflow with Regions
1. **PREPARER** (MARIIS) creates proposal
2. **REVIEWER** (MARIIS) reviews proposal
3. **APPROVER** (MARIIS) approves proposal
4. **ANALYST** (MARIIS-only) receives proposal → Can see it
5. **ANALYST** (NIA-Wide) receives proposal → Can see it
6. **ANALYST** (CALABARZON-only) should NOT see MARIIS proposal

**Expected Result**: ✅ Correct proposal routing based on regions

---

## Debugging

### Check Region Assignment in Database
```javascript
db.hierarchicaluserassignments.findOne({
  userId: "USER_ID",
  userRole: "BUDGET_PLANNING_ANALYST"
})
// Should return:
// {
//   isNIAWide: false,
//   assignedRegions: ["MARIIS", "CALABARZON"]
// }
```

### Check Middleware Logs
When BUDGET_PLANNING_ANALYST queries proposals, logs show:
```
🔐 [budgetRoleVisibilityControl] BUDGET_PLANNING_ANALYST region filtering: {
  userId: "12345",
  isNIAWide: false,
  assignedRegions: ["MARIIS"],
  hierarchicalAssignment: { ... }
}
🔒 BUDGET_PLANNING_ANALYST restricted to regions: MARIIS
```

---

## Impact on Other Roles

### BUDGET PREPARER
- ❌ Region filtering: **NOT applied** (stays in their own region naturally)
- Access: Controlled by organizational hierarchy

### BUDGET REVIEWER
- ❌ Region filtering: **NOT applied**
- Access: Reviews based on division assignment

### BUDGET APPROVER
- ❌ Region filtering: **NOT applied**
- Access: Approves based on division assignment

### BUDGET_PLANNING_ANALYST
- ✅ Region filtering: **NEWLY APPLIED**
- Access: Controlled by `isNIAWide` and `assignedRegions`

### BUDGET_OFFICER
- ❌ Region filtering: **NOT applied**
- Access: Can see all proposals for final decision

### OVERALL_BUDGET_APPROVER
- ❌ Region filtering: **NOT applied**
- Access: Can see all proposals for executive approval

---

## API Endpoints

### Get All Proposals (with Region Filtering)
```
GET /api/my-proposals/all
```

**Request**: (Authorization header with JWT)

**Response Filtering**:
- Applied by middleware: `budgetRoleVisibilityControl`
- Based on: `req.user.hierarchicalAssignment`
- If BUDGET_PLANNING_ANALYST: Filtered by regions

**Example**:
```javascript
// User: BUDGET_PLANNING_ANALYST, assignedRegions: ['MARIIS']
GET /api/my-proposals/all
// Returns: Proposals where region == 'MARIIS'

// User: BUDGET_PLANNING_ANALYST, isNIAWide: true
GET /api/my-proposals/all
// Returns: All proposals from all regions
```

---

## Configuration

### Enable/Disable Region Filtering

Currently, region filtering for BUDGET_PLANNING_ANALYST is **ALWAYS ENABLED**.

To disable it, comment out the region filtering logic in the middleware:
```javascript
// Temporarily disable region filtering (NOT RECOMMENDED)
visibilityFilter = { $or: analystVisibilityOptions };
```

### Modify Region Matching

To match proposals by a different field (e.g., `officeName` instead of `region`):
```javascript
visibilityFilter = {
  $and: [
    { officeName: { $in: assignedRegions } },  // Changed from 'region'
    { $or: analystVisibilityOptions }
  ]
};
```

---

## ✅ Status: COMPLETE

Region-based workflow is fully implemented and operational:
- ✅ BUDGET_PLANNING_ANALYST can be assigned to NIA-Wide or specific regions
- ✅ Proposals are filtered based on analyst's region assignment
- ✅ Middleware enforces region restrictions transparently
- ✅ Other roles unaffected
- ✅ Backward compatible (existing assignments continue to work)

---

## Summary of Changes

| Component | Change | Impact |
|-----------|--------|--------|
| Middleware | Region filtering added for BUDGET_PLANNING_ANALYST | Proposals filtered by assigned regions |
| Frontend | Region selection UI | Analysts can be assigned to regions |
| Database | `isNIAWide` and `assignedRegions` fields | Stores region assignment configuration |
| API Response | Filtered by middleware | Only shows proposals analyst has access to |
| Logging | Added region filtering logs | Helps debug region-based access |

---

**Date**: November 4, 2025
**Status**: ✅ Production Ready
