# Complete Workflow Guide - From Draft to Finalization

**Last Updated:** November 7, 2025  
**Status:** Implementation Guide

---

## Workflow Overview

The 6-step workflow follows this sequence:

```
Draft (Created)
    ↓ [PREPARER submits]
Forwarded to Reviewer
    ↓ [REVIEWER approves & forwards]
Forwarded to Approver
    ↓ [APPROVER forwards]
Forwarded to Analyst
    ↓ [ANALYST validates & forwards]
Forwarded to Officer
    ↓ [OFFICER approves & forwards]
Forwarded to Manager
    ↓ [MANAGER finalizes]
Finalized
```

---

## Step-by-Step Workflow with Workflow History

### STEP 0: Draft Creation
**User:** Budget Preparer (PREPARER role)  
**Endpoint:** `POST /proposal-workflow/preparer/save-draft`  
**Frontend:** Click "Create Proposal" → Fill form → Save

**Request:**
```json
{
  "title": "2025 Budget for Personnel Services",
  "description": "Personnel budget for regional office",
  "fiscalYear": "2025",
  "budgetType": "Personnel Services",
  "region": "NCR"
}
```

**Backend Processing:**
1. Create new Proposal with `status: 'Draft'`
2. Initialize `workflowHistory: []` (empty array)
3. Set `createdByUserId: req.user.id`
4. Save proposal

**Workflow History After:**
```javascript
{
  workflowHistory: [],
  status: 'Draft',
  currentAssigneeRole: 'PREPARER'
}
```

**Frontend Display:**
- Proposal appears in "Drafts" tab
- "View Progress" button available (no actions yet)
- History dialog shows: "No history available"

---

### STEP 1: Preparer Submits Draft
**User:** Budget Preparer (PREPARER role)  
**Endpoint:** `POST /proposal-workflow/preparer/submit-to-reviewer`  
**Button:** "Submit to Reviewer"

**Request:**
```json
{
  "proposalId": "65abc123def456789xyz",
  "comment": "Draft submitted for initial review. All required sections completed."
}
```

**Backend Processing:**
1. Find proposal by ID
2. Verify user is creator: `proposal.createdByUserId === req.user.id`
3. Verify status is 'Draft'
4. Update status to 'Forwarded to Reviewer'
5. **Call `recordWorkflowEvent()`** with:
   - action: 'PREPARER_SUBMIT_TO_REVIEWER'
   - comment: user's comment
   - userId: req.user.id
   - userName: req.user.FirstName + ' ' + req.user.LastName
   - previousStatus: 'Draft'
   - newStatus: 'Forwarded to Reviewer'
   - targetRole: 'REVIEWER'
6. Save proposal
7. Send notification to REVIEWER role

**Workflow History After:**
```javascript
{
  workflowHistory: [
    {
      action: 'PREPARER_SUBMIT_TO_REVIEWER',
      comment: 'Draft submitted for initial review. All required sections completed.',
      userId: '416461',
      userName: 'John Doe',
      timestamp: ISODate('2025-11-07T10:30:00Z'),
      previousStatus: 'Draft',
      newStatus: 'Forwarded to Reviewer',
      targetRole: 'REVIEWER'
    }
  ],
  status: 'Forwarded to Reviewer',
  currentAssigneeRole: 'REVIEWER',
  pendingWithRoles: ['REVIEWER']
}
```

**Frontend Display:**
- Proposal moves from "Drafts" → removed (no longer visible to preparer)
- Appears in REVIEWER's "Pending" list
- "View Progress" button shows history:
  - Entry 1: "PREPARER_SUBMIT_TO_REVIEWER" by John Doe → Draft to Forwarded to Reviewer

---

### STEP 2: Reviewer Reviews & Approves
**User:** Budget Reviewer (REVIEWER or BUDGET_REVIEWER role)  
**Endpoint:** `POST /proposal-workflow/reviewer/approve-forward-to-approver`  
**Button:** "Approve & Forward to Approver"

**Request:**
```json
{
  "proposalId": "65abc123def456789xyz",
  "comment": "Initial review complete. All budget items properly documented. Ready for approval level."
}
```

**Backend Processing:**
1. Find proposal
2. Verify status is 'Forwarded to Reviewer'
3. Verify user has REVIEWER role
4. Update status to 'Forwarded to Approver'
5. Update currentAssigneeRole to 'APPROVER'
6. **Call `recordWorkflowEvent()`** with:
   - action: 'REVIEWER_APPROVE_AND_FORWARD'
   - comment: user's comment
   - previousStatus: 'Forwarded to Reviewer'
   - newStatus: 'Forwarded to Approver'
   - targetRole: 'APPROVER'
7. Save proposal
8. Send notification to APPROVER role

**Workflow History After:**
```javascript
{
  workflowHistory: [
    { /* entry 1 from step 1 */ },
    {
      action: 'REVIEWER_APPROVE_AND_FORWARD',
      comment: 'Initial review complete. All budget items properly documented. Ready for approval level.',
      userId: '416462',
      userName: 'Jane Smith',
      timestamp: ISODate('2025-11-07T11:15:00Z'),
      previousStatus: 'Forwarded to Reviewer',
      newStatus: 'Forwarded to Approver',
      targetRole: 'APPROVER'
    }
  ],
  status: 'Forwarded to Approver',
  currentAssigneeRole: 'APPROVER',
  pendingWithRoles: ['APPROVER']
}
```

**Frontend Display (for Approver):**
- Proposal appears in "Pending" list
- "View Progress" shows 2 history entries
- "Forward to Analyst" button available

---

### STEP 3: Approver Forwards to Analyst
**User:** Budget Approver (APPROVER role)  
**Endpoint:** `POST /proposal-workflow/approver/approve-forward-to-analyst`  
**Button:** "Forward to Analyst"

**Request:**
```json
{
  "proposalId": "65abc123def456789xyz",
  "comment": "Budget proposal approved. Forwarding for technical analysis and verification."
}
```

**Workflow History After:**
```javascript
{
  workflowHistory: [
    { /* entry 1 */ },
    { /* entry 2 */ },
    {
      action: 'APPROVER_APPROVE_FORWARD_ANALYST',
      comment: 'Budget proposal approved. Forwarding for technical analysis and verification.',
      userId: '416463',
      userName: 'Bob Johnson',
      timestamp: ISODate('2025-11-07T12:00:00Z'),
      previousStatus: 'Forwarded to Approver',
      newStatus: 'Forwarded to Analyst',
      targetRole: 'ANALYST'
    }
  ],
  status: 'Forwarded to Analyst',
  currentAssigneeRole: 'ANALYST',
  pendingWithRoles: ['ANALYST']
}
```

---

### STEP 4: Analyst Validates & Forwards
**User:** Budget Planning Analyst (ANALYST role)  
**Endpoint:** `POST /proposal-workflow/analyst/validate-forward-to-officer`  
**Button:** "Validate & Forward to Officer"

**Request:**
```json
{
  "proposalId": "65abc123def456789xyz",
  "comment": "Technical analysis complete. Budget items verified and consolidated. Ready for final review."
}
```

**Workflow History After:**
```javascript
{
  workflowHistory: [
    { /* entries 1-3 */ },
    {
      action: 'ANALYST_VALIDATE_FORWARD_OFFICER',
      comment: 'Technical analysis complete. Budget items verified and consolidated...',
      userId: '416464',
      userName: 'Alice Chen',
      timestamp: ISODate('2025-11-07T13:30:00Z'),
      previousStatus: 'Forwarded to Analyst',
      newStatus: 'Forwarded to Officer',
      targetRole: 'OFFICER'
    }
  ],
  status: 'Forwarded to Officer',
  currentAssigneeRole: 'OFFICER',
  pendingWithRoles: ['OFFICER']
}
```

---

### STEP 5: Officer Approves & Forwards to Manager
**User:** Budget Officer (OFFICER role)  
**Endpoint:** `POST /proposal-workflow/officer/approve-forward-to-manager`  
**Button:** "Approve & Forward to Manager"

**Request:**
```json
{
  "proposalId": "65abc123def456789xyz",
  "comment": "Officer verification complete. All requirements met. Forwarding for final approval by Budget Manager."
}
```

**Workflow History After:**
```javascript
{
  workflowHistory: [
    { /* entries 1-4 */ },
    {
      action: 'OFFICER_APPROVE_FORWARD_MANAGER',
      comment: 'Officer verification complete. All requirements met...',
      userId: '416465',
      userName: 'Carlos Reyes',
      timestamp: ISODate('2025-11-07T14:45:00Z'),
      previousStatus: 'Forwarded to Officer',
      newStatus: 'Forwarded to Manager',
      targetRole: 'MANAGER'
    }
  ],
  status: 'Forwarded to Manager',
  currentAssigneeRole: 'MANAGER',
  pendingWithRoles: ['MANAGER']
}
```

**Frontend Display (for Manager):**
- Proposal appears in "Pending Approval" list
- "View Progress" shows all 5 history entries
- "Finalize Proposal" button available

---

### STEP 6: Manager Finalizes
**User:** Budget Manager (MANAGER role)  
**Endpoint:** `POST /proposal-workflow/manager/finalize`  
**Button:** "Finalize Proposal"

**Request:**
```json
{
  "proposalId": "65abc123def456789xyz",
  "comment": "Budget proposal approved and finalized. Ready for implementation."
}
```

**Workflow History After:**
```javascript
{
  workflowHistory: [
    { /* entries 1-5 */ },
    {
      action: 'MANAGER_FINALIZE',
      comment: 'Budget proposal approved and finalized. Ready for implementation.',
      userId: '416466',
      userName: 'Diana Martinez',
      timestamp: ISODate('2025-11-07T15:30:00Z'),
      previousStatus: 'Forwarded to Manager',
      newStatus: 'Finalized',
      targetRole: 'COMPLETED'
    }
  ],
  status: 'Finalized',
  currentAssigneeRole: 'COMPLETED',
  pendingWithRoles: []
}
```

**Frontend Display:**
- Proposal moves to "Approved/Finalized" tab
- "View Progress" shows complete history (6 entries)
- No action buttons available (read-only)
- All roles can view history

---

## Return/Rejection Paths

At any step, the current approver can return the proposal:

### Example: Reviewer Returns to Preparer
**Endpoint:** `POST /proposal-workflow/reviewer/return-to-preparer`

**Request:**
```json
{
  "proposalId": "65abc123def456789xyz",
  "comment": "Budget items need clarification. Please revise and resubmit with detailed breakdowns."
}
```

**Status Change:** 'Forwarded to Reviewer' → 'Returned'

**Workflow History:**
```javascript
{
  workflowHistory: [
    { /* entry 1 */ },
    {
      action: 'REVIEWER_RETURN',
      comment: 'Budget items need clarification. Please revise and resubmit with detailed breakdowns.',
      userId: '416462',
      userName: 'Jane Smith',
      timestamp: ISODate('2025-11-07T11:45:00Z'),
      previousStatus: 'Forwarded to Reviewer',
      newStatus: 'Returned',
      targetRole: 'PREPARER'
    }
  ],
  status: 'Returned',
  currentAssigneeRole: 'PREPARER'
}
```

**Next Step:** Preparer can edit and resubmit

---

## View Progress / History Dialog

**When User Clicks "View Progress" or "History" Button:**

1. Frontend calls: `GET /api/proposal-workflow/history/:proposalId`
2. Backend returns:
```json
{
  "success": true,
  "history": [
    {
      "action": "PREPARER_SUBMIT_TO_REVIEWER",
      "comment": "Draft submitted...",
      "userName": "John Doe",
      "timestamp": "2025-11-07T10:30:00Z",
      "previousStatus": "Draft",
      "newStatus": "Forwarded to Reviewer"
    },
    // ... more entries
  ],
  "proposal": {
    "id": "65abc123def456789xyz",
    "title": "2025 Budget for Personnel Services",
    "status": "Forwarded to Approver",
    "region": "NCR",
    "department": "Regional Office"
  }
}
```

3. Frontend displays history dialog with:
   - Timeline of all actions
   - Who took each action
   - When it happened
   - What they said (comment)
   - Status changes

---

## Summary: What Happens at Each Step

| Step | Actor | Old Status | New Status | Action | History Record | Notification Sent |
|------|-------|-----------|-----------|--------|-----------------|-------------------|
| 0 | PREPARER | - | Draft | Save/Create | ❌ (Initial) | ❌ |
| 1 | PREPARER | Draft | Forwarded to Reviewer | Submit | ✅ | ✅ to REVIEWER |
| 2 | REVIEWER | Fwd to Reviewer | Fwd to Approver | Approve | ✅ | ✅ to APPROVER |
| 3 | APPROVER | Fwd to Approver | Fwd to Analyst | Forward | ✅ | ✅ to ANALYST |
| 4 | ANALYST | Fwd to Analyst | Fwd to Officer | Validate | ✅ | ✅ to OFFICER |
| 5 | OFFICER | Fwd to Officer | Fwd to Manager | Forward | ✅ | ✅ to MANAGER |
| 6 | MANAGER | Fwd to Manager | Finalized | Finalize | ✅ | ❌ (Complete) |

---

## Troubleshooting Common Issues

### Issue: "View Progress" button doesn't open dialog
**Checks:**
1. Verify proposal has `_id` property: Check browser console
2. Verify API endpoint is reachable: `GET /api/proposal-workflow/history/{id}`
3. Check if workflowHistory exists in database: `db.proposals.findOne({_id: ObjectId("...")})` 
4. Check backend logs for API errors

### Issue: History is empty
**Causes:**
1. Workflow history not initialized when proposal created
2. recordWorkflowEvent() not called properly in backend
3. Proposal status not being saved correctly
4. Database connection issue

**Fix:**
- Ensure preparerSaveDraft initializes `workflowHistory: []`
- Ensure preparerSubmitToReviewer calls recordWorkflowEvent()
- Check MongoDB connection and verify data is being persisted

### Issue: Button text says "History" but no actions available
**Status:** This is expected
- When user cannot act: button shows "View Progress"
- When user can act: button shows "History"
- History available at all times

---

## Implementation Verification Checklist

- [ ] Draft creation initializes empty workflowHistory
- [ ] preparerSubmitToReviewer records PREPARER_SUBMIT_TO_REVIEWER action
- [ ] reviewerApproveAndForward records REVIEWER_APPROVE_AND_FORWARD action
- [ ] approverApproveAndForwardToAnalyst records action
- [ ] analystValidateAndForwardToOfficer records action
- [ ] officerApproveAndForwardToManager records action
- [ ] managerFinalizeProposal records MANAGER_FINALIZE action
- [ ] All return endpoints record return actions
- [ ] GET /api/workflow/history/:proposalId returns correct format
- [ ] Frontend dialog displays history correctly
- [ ] All notifications sent to correct roles

---

## Accessing the Workflow - All Proposals Page

### **Location**: `/all-proposals`
**Component**: `AllProposalsPage.jsx`

### **What You See**

A comprehensive table displaying all proposals with:
- **Proposal Information**: Title, Fiscal Year, Budget Type, Region
- **Current Status**: Draft, Forwarded to Reviewer, Forwarded to Approver, etc.
- **Progress Indicators**: Visual status badges showing workflow stage
- **Action Buttons**: View, Workflow Actions, and Approvals (based on your role)

### **How to View Proposal Details**

#### **1. View Full Proposal**
```
1. Click "View" button in the proposal row
2. Dialog opens showing:
   - Title, Description, Fiscal Year
   - Budget Type, Region, Department, Division
   - All components (Personnel Services, MOOE, Capital Outlay, Income)
   - Current status and assignee role
```

#### **2. View Workflow History**
```
1. Click "View Progress" button (if you cannot act on proposal)
   OR "History" button (if you have actions available)
2. Dialog opens showing:
   - Complete timeline of all actions taken
   - Who took each action and when
   - What they said (comments)
   - Status changes at each step
   - Target roles for next step
```

#### **3. Take Workflow Actions**
```
Based on your role and proposal status:
- PREPARER: Submit to Reviewer, Save as Draft
- REVIEWER: Approve & Forward to Approver, Return to Preparer
- APPROVER: Forward to Analyst, Return to Reviewer
- ANALYST: Validate & Forward to Officer, Return to Approver
- OFFICER: Approve & Forward to Manager, Return to previous role
- MANAGER: Finalize, Return to Officer
```

### **Button Reference**

| Button | Purpose | Who Uses It |
|--------|---------|------------|
| **View** | Opens proposal details dialog | All roles |
| **View Progress** / **History** | Shows complete workflow history | All roles |
| **Submit** | Move proposal to next stage | Current assignee |
| **Approve** | Approve and forward to next role | Reviewer/Approver/Officer/Manager |
| **Return** | Send back with comments for revision | Current assignee |
| **Save as Draft** | Save changes without submitting | PREPARER |

### **Status Badges Explained**

```
Draft              → Proposal created, not yet submitted
Forwarded to...    → Currently with that role for action
Finalized          → Completed entire workflow, approved
Returned           → Sent back for revision
```

### **Example Workflow in All Proposals Page**

```
Step 1: View the proposal
  → Click "View" button
  → See all components (Personnel, MOOE, Capital, Income)

Step 2: Check history before acting
  → Click "History" button
  → See what happened in previous steps
  → See comments from other roles

Step 3: Take action
  → Click "Approve & Forward to Approver" (if you're Reviewer)
  → Add your comment (why you're approving)
  → Click Submit
  → Proposal moves to next role

Step 4: Other roles repeat
  → Approver sees it, clicks "History" to review
  → Approver forwards to Analyst
  → Analyst validates and forwards to Officer
  → Officer approves and forwards to Manager
  → Manager finalizes

Result: Complete audit trail in History
  → Everyone can see who did what and when
  → All comments are preserved
  → All status changes are recorded
```

### **Tips for Using All Proposals Page**

✅ **Always check history before acting** - See context from previous steps  
✅ **Add comments** - Explain your decision to next role  
✅ **Use filters** - Filter by status, fiscal year, region  
✅ **Select multiple** - Bulk approve similar proposals  
✅ **Track totals** - See summary statistics at top  

### **Common Tasks**

**I want to approve a proposal:**
1. Go to `/all-proposals`
2. Find proposal with status "Forwarded to [Your Role]"
3. Click "View" to check details
4. Click "History" to see comments
5. Click "Approve & Forward to [Next Role]"
6. Add your comment and submit

**I want to return a proposal:**
1. Go to `/all-proposals`
2. Click "Return" button on proposal row
3. Add detailed comment explaining why
4. Click Submit
5. Proposal goes back to previous role

**I want to see who did what:**
1. Go to `/all-proposals`
2. Find proposal
3. Click "History" or "View Progress"
4. See complete timeline with all actions, comments, users, timestamps
