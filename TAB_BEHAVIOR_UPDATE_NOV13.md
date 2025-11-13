# Tab Behavior Update - Budget Preparer "My Proposals"
**Date:** November 13, 2025

## Change Summary

Updated the "My Proposals" tab behavior to only show DRAFT proposals that the Budget Preparer has created, not submitted ones.

## Previous Behavior
- **My Proposals** → Showed ALL proposals created by the user (DRAFT, Forwarded, Returned, etc.)
- Submitted proposals remained in the user's "My Proposals" view

## New Behavior
- **My Proposals** → Shows ONLY DRAFT proposals created by the user
- Once a proposal is submitted, it disappears from "My Proposals"
- The proposal will appear in:
  - **Pending Review** → For the appropriate reviewer based on its status
  - **All Proposals** → If the user has access to view all proposals

## Technical Details

**File:** `SERVER/controllers/newProposalWorkflowController.js` (Lines 193-197)

### Code Change

```javascript
case 'my-proposals':
  query.createdBy = userName;
  // Only show DRAFT proposals in "My Proposals" tab for Budget Preparer
  query.status = 'Draft';
  break;
```

## Workflow Tabs Explained

### 1. **My Proposals** (For Budget Preparer)
- ✅ Shows: Draft proposals created by me
- ❌ Does NOT show: Submitted, Approved, Rejected proposals
- **Purpose:** Focus on proposals I'm still working on

### 2. **Pending Review** (For All Roles)
- Shows proposals that require action from the current user
- Varies by role:
  - Budget Preparer: Proposals returned to them
  - Budget Reviewer: Proposals forwarded to reviewer
  - Budget Approver: Proposals forwarded to approver
  - BRD Staff: Proposals forwarded to their level

### 3. **All Proposals** (For BRD/Admins)
- Shows all non-draft proposals in the system
- Available to: Budget Planning Analyst, Budget Officer, Budget Manager, Super Admin

## User Experience Flow

1. Budget Preparer creates a proposal → Appears in "My Proposals" as DRAFT
2. Budget Preparer edits/works on it → Still in "My Proposals"
3. Budget Preparer submits to reviewer → **Disappears from "My Proposals"**
4. Proposal moves through workflow → Appears in "Pending Review" for appropriate roles
5. If returned to preparer → Appears back in "My Proposals" as DRAFT

## Benefits

✅ Cleaner "My Proposals" view focused on active work  
✅ Prevents confusion about submitted vs. draft proposals  
✅ Encourages users to check "Pending Review" for action items  
✅ Better separation of concerns between tabs  

## Notes

- This change applies to the old Proposal model (used by current API)
- When NewProposalWorkflow becomes primary, same logic will apply
- "My Proposals" is now essentially "My Draft Proposals"
