# Budget Proposal Workflow - Refactored 6-Step Implementation

**Date:** September 2025  
**Status:** Refactored and Ready for Testing  
**Author:** Development Team

---

## Executive Summary

This document describes the **refactored 6-step budget proposal workflow** that implements a comprehensive budget preparation and approval process. The workflow ensures proper authorization, audit trails, and role-based visibility across all budget proposal stages.

---

## Workflow Overview

The proposal workflow consists of **6 main steps** with **7 key roles**:

### Workflow Steps

1. **PREPARER** (Draft → Forwarded to Reviewer)
2. **REVIEWER** (Forwarded to Reviewer → Forwarded to Approver or Returned)
3. **APPROVER** (Forwarded to Approver → Forwarded to Analyst/Officer or Returned)
4. **BUDGET PLANNING ANALYST** (Forwarded to Analyst → Forwarded to Officer or Returned)
5. **BUDGET OFFICER** (Forwarded to Officer → Forwarded to Manager or Returned)
6. **BUDGET MANAGER** (Forwarded to Manager → Finalized or Returned)
7. **BRD (Budget Revenue Division)** - Monitoring at all levels

### Proposal Statuses

- **Draft** - Initial state, preparer editing
- **Forwarded to Reviewer** - Awaiting reviewer approval
- **Forwarded to Approver** - Awaiting budget approver
- **Forwarded to Analyst** - For technical analysis
- **Forwarded to Officer** - For budget officer review
- **Forwarded to Manager** - For final approval
- **Finalized** - Workflow complete
- **Returned** - Sent back for revisions

---

## Role Definitions & Responsibilities

### 1. Budget Preparer (PREPARER)
**Permissions:**
- Create new proposals (Draft status)
- Save draft changes
- Submit proposal to Budget Reviewer
- Edit own proposals while in Draft status
- View own proposals and proposals from their division

**Workflow Transitions:**
- Save Draft → remains in Draft
- Submit to Reviewer → Forwarded to Reviewer
- Receive returned proposals → Draft

### 2. Budget Reviewer (REVIEWER)
**Permissions:**
- Review proposals from preparers
- Request changes or approve
- Forward approved proposals to Budget Approver
- Return proposals for revision

**Workflow Transitions:**
- Review & Approve → Forward to Approver (Forwarded to Approver)
- Return → Returned (back to Preparer)

### 3. Budget Approver (APPROVER)
**Permissions:**
- Review proposals from Budget Reviewer
- Choose approval path:
  - Route through Budget Planning Analyst (for detailed analysis)
  - Route directly to Budget Officer (for expedited approval)
- Return proposals for revision

**Workflow Transitions:**
- Approve & Forward to Analyst → Forwarded to Analyst
- Approve & Forward to Officer → Forwarded to Officer (bypass analyst)
- Return → Returned (back to Reviewer)

### 4. Budget Planning Analyst (BUDGET_PLANNING_ANALYST)
**Permissions:**
- Perform technical/financial analysis
- Validate proposal data completeness
- Add analysis notes/comments
- Forward to Budget Officer after analysis
- Return for corrections

**Workflow Transitions:**
- Validate & Forward to Officer → Forwarded to Officer
- Return → Returned (back to Approver)

### 5. Budget Officer (BUDGET_OFFICER)
**Permissions:**
- Verify proposal completeness and compliance
- Perform financial review
- Approve and forward to Budget Manager
- Request corrections/return for revision

**Workflow Transitions:**
- Approve & Forward to Manager → Forwarded to Manager
- Return → Returned (back to Analyst or Approver, depending on route)

### 6. Budget Manager (BUDGET_MANAGER)
**Permissions:**
- Perform final review
- Approve/Finalize proposal
- Return for final corrections

**Workflow Transitions:**
- Finalize → Finalized (workflow complete)
- Return → Returned (back to Officer)

### 7. BRD Admin (BRD_ADMIN / BUDGET_ADMIN)
**Permissions:**
- Full visibility of all proposals across all statuses
- Access monitoring dashboard
- View audit logs and change history
- Filter by region, status, and other criteria
- Generate reports

---

## API Endpoints (Refactored)

### Preparer Endpoints

#### Save Draft
```
POST /api/proposal-workflow/preparer/save-draft
Body: {
  proposalId: (optional - if editing existing),
  title: "string",
  description: "string",
  fiscalYear: "2025",
  budgetType: "string",
  region: "string"
}
Response: { success: true, proposal: {...} }
```

#### Submit to Reviewer
```
POST /api/proposal-workflow/preparer/submit-to-reviewer
Body: {
  proposalId: "ObjectId",
  comment: "string" (required - must not be empty)
}
Response: { 
  success: true, 
  message: "Proposal submitted to Budget Reviewer successfully",
  proposal: {...}
}
```

### Reviewer Endpoints

#### Approve and Forward to Approver
```
POST /api/proposal-workflow/reviewer/approve-forward-to-approver
Body: {
  proposalId: "ObjectId",
  comment: "string" (required)
}
Status: Forwarded to Reviewer → Forwarded to Approver
```

#### Return to Preparer
```
POST /api/proposal-workflow/reviewer/return-to-preparer
Body: {
  proposalId: "ObjectId",
  comment: "string" (required)
}
Status: Forwarded to Reviewer → Returned
```

### Approver Endpoints

#### Approve and Forward to Analyst
```
POST /api/proposal-workflow/approver/approve-forward-to-analyst
Body: {
  proposalId: "ObjectId",
  comment: "string" (required)
}
Status: Forwarded to Approver → Forwarded to Analyst
```

#### Approve and Forward to Officer (Skip Analyst)
```
POST /api/proposal-workflow/approver/approve-forward-to-officer
Body: {
  proposalId: "ObjectId",
  comment: "string" (required)
}
Status: Forwarded to Approver → Forwarded to Officer
Note: Sets bypassedAnalyst flag on proposal
```

#### Return to Reviewer
```
POST /api/proposal-workflow/approver/return-to-reviewer
Body: {
  proposalId: "ObjectId",
  comment: "string" (required)
}
Status: Forwarded to Approver → Returned
```

### Analyst Endpoints

#### Validate and Forward to Officer
```
POST /api/proposal-workflow/analyst/validate-forward-to-officer
Body: {
  proposalId: "ObjectId",
  comment: "string" (required - validation notes)
}
Status: Forwarded to Analyst → Forwarded to Officer
```

#### Return to Approver
```
POST /api/proposal-workflow/analyst/return-to-approver
Body: {
  proposalId: "ObjectId",
  comment: "string" (required)
}
Status: Forwarded to Analyst → Returned
```

### Officer Endpoints

#### Approve and Forward to Manager
```
POST /api/proposal-workflow/officer/approve-forward-to-manager
Body: {
  proposalId: "ObjectId",
  comment: "string" (required)
}
Status: Forwarded to Officer → Forwarded to Manager
```

#### Return Proposal
```
POST /api/proposal-workflow/officer/return-proposal
Body: {
  proposalId: "ObjectId",
  comment: "string" (required)
}
Status: Forwarded to Officer → Returned
Returns to: Budget Analyst (if didn't bypass) OR Approver (if bypassed)
```

### Manager Endpoints

#### Finalize Proposal
```
POST /api/proposal-workflow/manager/finalize
Body: {
  proposalId: "ObjectId",
  comment: "string" (required - final approval notes)
}
Status: Forwarded to Manager → Finalized
Marks workflow as complete
```

#### Return to Officer
```
POST /api/proposal-workflow/manager/return-to-officer
Body: {
  proposalId: "ObjectId",
  comment: "string" (required)
}
Status: Forwarded to Manager → Returned
```

### Monitoring & History Endpoints

#### Get Proposal History
```
GET /api/proposal-workflow/history/:proposalId
Response: {
  success: true,
  history: [
    {
      action: "PREPARER_SUBMIT_TO_REVIEWER",
      comment: "string",
      userId: "ObjectId",
      userName: "string",
      timestamp: "ISO8601",
      previousStatus: "Draft",
      newStatus: "Forwarded to Reviewer",
      targetRole: "REVIEWER"
    },
    ...
  ]
}
```

#### Get BRD Monitoring Dashboard
```
GET /api/proposal-workflow/brd-dashboard?region=NCR&status=Forwarded to Officer&search=keyword
Response: {
  success: true,
  proposals: [
    {
      _id: "ObjectId",
      title: "string",
      status: "string",
      region: "string",
      division: "string",
      department: "string",
      currentAssigneeRole: "OFFICER",
      lastActionBy: "string",
      lastActionDate: "ISO8601"
    },
    ...
  ],
  statistics: {
    totalProposals: 45,
    byStatus: [
      { _id: "Forwarded to Officer", count: 15 },
      { _id: "Forwarded to Manager", count: 10 },
      ...
    ],
    byRegion: [
      { _id: "NCR", count: 20 },
      { _id: "Region 1", count: 15 },
      ...
    ]
  }
}
```

---

## Workflow Diagrams

### Happy Path (No Returns)

```
┌─────────┐     submit    ┌─────────┐    approve    ┌──────────┐
│Preparer ├─────────────→ │Reviewer ├──────────────→ │ Approver │
└─────────┘               └─────────┘               └──────────┘
                                                           │
                                ┌──────────────────────────┼──────────────────┐
                                │                          │                  │
                            forward to Analyst         forward to Officer   
                                │                          │                  
                                ▼                          ▼                  ▼
                          ┌──────────┐             ┌──────────────┐    [Bypass Path]
                          │  Analyst │             │   Officer    │
                          └──────────┘             └──────────────┘
                                │                          │
                                └──────────────────────────┘
                                        │
                                    forward to Manager
                                        │
                                        ▼
                                  ┌──────────┐
                                  │ Manager  │
                                  └──────────┘
                                        │
                                     finalize
                                        │
                                        ▼
                                  ┌──────────┐
                                  │Finalized │
                                  └──────────┘
```

### Return Path Examples

```
Reviewer finds issues:
  Forwarded to Reviewer ──return──→ Draft (back to Preparer)

Approver needs revision:
  Forwarded to Approver ──return──→ Returned (back to Reviewer)

Analyst requests changes:
  Forwarded to Analyst ──return──→ Returned (back to Approver)

Officer needs revision:
  Forwarded to Officer ──return──→ Returned (back to Analyst or Approver)

Manager final review corrections:
  Forwarded to Manager ──return──→ Returned (back to Officer)
```

---

## Key Features

### 1. Flexible Approval Routing
- **Standard Route**: Preparer → Reviewer → Approver → Analyst → Officer → Manager
- **Fast-Track Route**: Preparer → Reviewer → Approver → Officer → Manager (bypass Analyst)

### 2. Comprehensive Audit Trail
- Every action recorded with:
  - User ID and name
  - Role performing action
  - Timestamp
  - Previous and new status
  - Comment/notes
  - Target role

### 3. Role-Based Visibility
- Preparers see: Own proposals + division proposals
- Reviewers see: Forwarded to Reviewer proposals
- Approvers see: Forwarded to Approver proposals
- Analysts see: Forwarded to Analyst proposals
- Officers see: Forwarded to Officer proposals
- Managers see: Forwarded to Manager + Finalized proposals
- BRD sees: ALL proposals (monitoring dashboard)

### 4. Mandatory Comments
- Every workflow transition requires a comment
- Comments capture decision rationale and change requests
- Full traceability for compliance and audit

### 5. BRD Monitoring Dashboard
- Real-time view of all proposals
- Filter by region, status, and keywords
- Statistics dashboard (counts by status/region)
- Quick access to full audit history

### 6. Budget Item Synchronization
- Status automatically syncs to:
  - Personnel Services
  - Capital Outlay
  - MOOE Proposals
  - Income Records
- Ensures consistency across all budget modules

---

## Implementation Notes

### Model Changes
The `Proposal` model tracks:
- `status` - Current workflow status
- `currentAssigneeRole` - Current role with proposal
- `pendingWithRoles` - Array of roles that can act on proposal
- `workflowHistory` - Complete audit trail
- `bypassedAnalyst` - Flag if Analyst step was skipped
- `createdByUserId` - Original preparer
- `approvedByUserId`, `analyzedByUserId`, etc. - Who approved at each step
- `finalizedByUserId` - Who finalized the proposal

### Controller Organization
The refactored controller `proposalWorkflowController_refactored.js` includes:
- Helper functions for role extraction and validation
- One function per role per action (e.g., `preparerSaveDraft`, `reviewerApproveAndForward`)
- Centralized error handling
- Notification system integration
- Budget item sync logic

### Route Changes
New routes added to `proposalWorkflowRoutes.js`:
- All refactored endpoints under new paths (e.g., `/preparer/save-draft`)
- Legacy routes preserved for backward compatibility
- Both controllers available for gradual migration

---

## Testing Scenarios

### Scenario 1: Standard Approval Path
1. Preparer saves draft
2. Preparer submits to reviewer
3. Reviewer approves and forwards to approver
4. Approver forwards to analyst
5. Analyst validates and forwards to officer
6. Officer approves and forwards to manager
7. Manager finalizes

### Scenario 2: Fast-Track Approval
1. Preparer creates and submits proposal
2. Reviewer approves
3. Approver approves and **bypasses analyst**
4. Officer reviews
5. Manager finalizes

### Scenario 3: Multi-Level Returns
1. Proposal goes through reviewer, approver, analyst
2. Officer returns for corrections
3. Analyst revises and resubmits
4. Officer approves
5. Manager finalizes

### Scenario 4: BRD Monitoring
1. BRD admin accesses `/brd-dashboard`
2. Views all proposals by status
3. Filters by region (e.g., NCR)
4. Clicks on proposal to view full audit trail
5. Generates compliance report

---

## Migration Path

### Phase 1: Deploy New Controller (Done)
- Create `proposalWorkflowController_refactored.js`
- Add new routes alongside existing ones
- Keep old controller active

### Phase 2: Frontend Update
- Update UI to use new endpoints
- Test new workflow in staging
- Monitor for errors

### Phase 3: Cutover
- Switch traffic to new endpoints
- Keep old endpoints as fallback
- Monitor production closely

### Phase 4: Cleanup (Future)
- Remove old controller once stable
- Remove legacy routes
- Archive old controller version

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "User-friendly error description",
  "error": "Technical error details"
}
```

Common HTTP Status Codes:
- **400** - Bad request (missing fields, invalid status)
- **403** - Forbidden (user lacks permission for this action)
- **404** - Not found (proposal doesn't exist)
- **500** - Server error

---

## Security Considerations

1. **Role-Based Access Control**
   - Every endpoint validates user role
   - Cannot perform actions outside assigned role

2. **Audit Trail**
   - All changes logged with user attribution
   - Immutable workflow history

3. **Comment Validation**
   - Required for all transitions
   - Prevents accidental submissions without rationale

4. **Status Validation**
   - Endpoints validate current status before transition
   - Prevents invalid workflow transitions

5. **BRD Admin Access**
   - Monitoring dashboard restricted to BRD admins
   - Separate authentication check

---

## Troubleshooting

### Proposal Stuck in Status
**Cause:** Invalid status or missing approval
**Solution:** Check workflow history, verify user role, manually review database

### Comments Not Required
**Solution:** All endpoints now require comments - validation happens at POST

### Notifications Not Sent
**Solution:** Check Notification model, verify SMTP configuration

### Budget Items Not Syncing
**Solution:** Check syncBudgetItemsStatus logs, verify filter criteria

---

## Future Enhancements

1. Workflow templates for different proposal types
2. Conditional routing based on proposal amount
3. Parallel approvals for multiple reviewers
4. Scheduled workflow deadline tracking
5. Proposal status webhooks
6. Advanced analytics dashboard

---

## Contact & Support

For questions or issues with the refactored workflow, contact the Development Team.

**Related Documentation:**
- Budget_Proposal_Workflow.md (Original specification)
- proposalController.js (Main proposal CRUD)
- budgetOfficerEditController.js (Edit tracking)

---

*Last Updated: November 7, 2025*
*Version: 1.0 (Refactored)*
