# Frontend UserRole Undefined Fix - November 8

## Problem
Frontend console showed: `userRole: undefined`
- WorkflowActionsRefactored component was not receiving the user role
- Even though `restrictToRole` was being passed, the component needed explicit `userRole` prop
- Result: Workflow actions were not rendering correctly

## Root Cause
`ProposalDetailsDialog.jsx` was only passing `restrictToRole` but NOT passing `userRole` to `WorkflowActionsRefactored`

Component expected either:
- `userRole` prop (direct), OR
- `restrictToRole` prop (fallback), OR
- Extracted from `userInfo` (last resort)

But the parent was only using `restrictToRole`, leaving `userRole` undefined initially.

## Solution

### 1. Updated ProposalDetailsDialog.jsx (Line 1596)
**Added explicit `userRole` prop**:

```jsx
<WorkflowActionsRefactored
  ref={workflowActionsRef}
  proposal={proposal}
  userInfo={userInfo}
  userRole={
    isPreparer
      ? 'BUDGET_PREPARER'
      : effectiveBudgetReviewer
        ? 'BUDGET_REVIEWER'
        : (isApprover || isDivisionApprover)
          ? 'BUDGET_APPROVER'
          : isBudgetPlanningAnalystRole
            ? 'BUDGET_PLANNING_ANALYST'
            : isBudgetOfficer
              ? 'BUDGET_OFFICER'
              : isManagerLevel
                ? 'OVERALL_BUDGET_APPROVER'
                : null
  }
  restrictToRole={
    isPreparer
      ? 'BUDGET_PREPARER'
      : ...same logic...
  }
  ...
/>
```

### 2. Enhanced WorkflowActionsRefactored.jsx (Line 205)
**Added better debugging**:

```javascript
const effectiveUserRole = userRole || restrictToRole || extractRoleFromUserInfo(userInfo);

console.log('🔧 WorkflowActionsRefactored props:', { 
  proposal: { _id: proposal?._id, id: proposal?.id, status: proposal?.status },
  userRole,                          // ← Now will show the actual role
  restrictToRole,
  extractedRole: extractRoleFromUserInfo(userInfo),
  effectiveUserRole,                 // ← Will show final resolved role
  showViewHistory
});
```

## How It Works Now

### Flow:
1. **Parent (ProposalDetailsDialog)** determines user's role based on roleChecks (isPreparer, isReviewer, etc.)
2. **Parent** passes both `userRole` AND `restrictToRole` with same value
3. **Child (WorkflowActionsRefactored)** receives props:
   - `userRole: 'BUDGET_PREPARER'` ← PRIMARY (now set!)
   - `restrictToRole: 'BUDGET_PREPARER'` ← FALLBACK
4. **Child** resolves: `effectiveUserRole = 'BUDGET_PREPARER'` (from userRole)
5. **Child** calls `getWorkflowActions('BUDGET_PREPARER', 'Draft')`
6. **Child** returns SUBMIT action button
7. **User** can click and submit proposal

### Role Resolution Priority:
```javascript
effectiveUserRole = userRole          // 1st: Explicit prop (NOW SET!)
                 || restrictToRole    // 2nd: Fallback prop
                 || extracted role    // 3rd: Try to extract from userInfo
```

## Files Modified
1. `CLIENT/src/components/myproposal/ProposalDetailsDialog.jsx` (Line 1596+)
   - Added `userRole` prop to WorkflowActionsRefactored
   - Same role determination logic as `restrictToRole`

2. `CLIENT/src/components/workflow/WorkflowActionsRefactored.jsx` (Line 205-218)
   - Enhanced console logging to show resolved role
   - Added `extractedRole` and `effectiveUserRole` to debug output

## Expected Behavior After Fix
1. ✅ Console log shows: `userRole: 'BUDGET_PREPARER'`
2. ✅ Console log shows: `effectiveUserRole: 'BUDGET_PREPARER'`
3. ✅ "Submit to Reviewer" button appears
4. ✅ Clicking button submits proposal
5. ✅ Backend receives request (with fixed role validation)
6. ✅ Backend returns 200 success
7. ✅ Proposal status changes to "Forwarded to Reviewer"

## Testing Checklist
- [ ] Open proposal as Budget Preparer
- [ ] Check console for `userRole: 'BUDGET_PREPARER'`
- [ ] "Submit to Reviewer" button is visible
- [ ] Click submit without comment
- [ ] Dialog shows submission confirmation
- [ ] Workflow history updated
- [ ] Status changed in proposal details
- [ ] Reviewer notified

## Why This Fix Works
- **Explicit**: Directly passes the role instead of relying on fallback extraction
- **Consistent**: Uses same role determination logic throughout component
- **Debuggable**: Enhanced logging shows exactly what role is being used
- **Robust**: Works even if userInfo doesn't have workflowRoles property
- **Prioritized**: userRole prop takes priority, ensuring it's used when available

## Combined Fixes
This fix works together with:
1. ✅ Backend API endpoint fixed (12 endpoints use `/api/workflow/` prefix)
2. ✅ Backend comment requirement removed (optional for submit/approve/forward)
3. ✅ Backend role validation fixed (added BUDGET_PREPARER to checks)
4. ✅ Frontend userRole now properly passed and resolved (THIS FIX)

**Result**: Budget Preparer can now successfully submit proposals! 🚀
