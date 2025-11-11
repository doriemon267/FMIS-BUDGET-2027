# Proposal Workflow Refactoring - Quick Start Guide

**TL;DR:** Clean, organized 6-step workflow with flexible routing and mandatory audit comments.

---

## The 6 Steps

```
1. PREPARER     → Creates & submits draft
2. REVIEWER     → Reviews & approves
3. APPROVER     → Routes (analyst or direct)
4. ANALYST      → (Optional) Validates
5. OFFICER      → Final compliance check
6. MANAGER      → Finalizes
```

---

## Key Files

| File | Purpose |
|------|---------|
| `proposalWorkflowController_refactored.js` | Clean workflow logic (new) |
| `proposalWorkflowRoutes.js` | API endpoints (updated) |
| `PROPOSAL_WORKFLOW_REFACTORED_SEPTEMBER_2025.md` | Full documentation |
| `PROPOSAL_WORKFLOW_REFACTORING_COMPLETE.md` | Implementation summary |

---

## New Endpoints (Pick Your Role)

### I'm a **Preparer**
```bash
# Save a draft
POST /preparer/save-draft
{ title, description, fiscalYear, budgetType, region }

# Submit for review
POST /preparer/submit-to-reviewer
{ proposalId, comment }
```

### I'm a **Reviewer**
```bash
# Approve & send to approver
POST /reviewer/approve-forward-to-approver
{ proposalId, comment }

# Or send back
POST /reviewer/return-to-preparer
{ proposalId, comment }
```

### I'm an **Approver**
```bash
# Option 1: Route through analyst (standard)
POST /approver/approve-forward-to-analyst
{ proposalId, comment }

# Option 2: Skip analyst (fast-track)
POST /approver/approve-forward-to-officer
{ proposalId, comment }

# Or send back
POST /approver/return-to-reviewer
{ proposalId, comment }
```

### I'm an **Analyst**
```bash
# Validate & forward
POST /analyst/validate-forward-to-officer
{ proposalId, comment }

# Or send back
POST /analyst/return-to-approver
{ proposalId, comment }
```

### I'm an **Officer**
```bash
# Approve & send to manager
POST /officer/approve-forward-to-manager
{ proposalId, comment }

# Or send back
POST /officer/return-proposal
{ proposalId, comment }
```

### I'm a **Manager**
```bash
# Finalize (done!)
POST /manager/finalize
{ proposalId, comment }

# Or send back
POST /manager/return-to-officer
{ proposalId, comment }
```

### I'm **BRD Admin**
```bash
# View everything
GET /brd-dashboard?region=NCR&status=Forwarded to Officer&search=keyword
```

---

## Important Rules

✅ **MUST have:**
- User role verified (extracted from `req.user.Roles`)
- Comment for every action (audit trail)
- Proposal in correct status

❌ **CANNOT do:**
- Skip roles (no Preparer→Approver shortcuts)
- Act on wrong status (e.g., approve Draft)
- Act outside your role
- Leave comments empty

---

## Testing Quick Path

### Happy Path (Fast-Track)
```
1. POST /preparer/save-draft
2. POST /preparer/submit-to-reviewer
3. POST /reviewer/approve-forward-to-approver
4. POST /approver/approve-forward-to-officer [SKIP ANALYST]
5. POST /officer/approve-forward-to-manager
6. POST /manager/finalize
```

### With Analyst
```
1-3. Same as above
4. POST /approver/approve-forward-to-analyst
5. POST /analyst/validate-forward-to-officer
6. POST /officer/approve-forward-to-manager
7. POST /manager/finalize
```

### With Return
```
1-3. Same as above
4. POST /approver/return-to-reviewer [SENDS BACK]
5. POST /reviewer/return-to-preparer [SENDS BACK]
```

---

## Error Messages You'll See

| Error | Cause | Fix |
|-------|-------|-----|
| "Only Preparers can save drafts" | Wrong role | Use correct user account |
| "Comment is required" | Empty comment | Add a comment |
| "Proposal must be in Draft status" | Wrong status | Check current status first |
| "You do not have permission" | Access denied | Wrong user/role |
| "Proposal not found" | Invalid ID | Check proposal ID |

---

## Checking Status

```bash
# See where proposal is at
GET /history/:proposalId

Response:
{
  history: [
    { 
      action: "PREPARER_SUBMIT_TO_REVIEWER",
      status: "Draft" → "Forwarded to Reviewer",
      user: "John Smith",
      comment: "Initial submission",
      timestamp: "2025-11-07T10:30:00Z"
    },
    ...
  ]
}
```

---

## Common Patterns

### Submit Proposal (Preparer)
```javascript
// Create draft
const draft = await POST /preparer/save-draft { title, ... }

// Submit when ready
const result = await POST /preparer/submit-to-reviewer { 
  proposalId: draft.proposal._id, 
  comment: "Ready for review"
}
```

### Approve & Route (Approver)
```javascript
// If simple: fast-track to officer
await POST /approver/approve-forward-to-officer {
  proposalId: id,
  comment: "Straightforward budget - approve for direct review"
}

// If complex: route through analyst
await POST /approver/approve-forward-to-analyst {
  proposalId: id,
  comment: "Complex regional allocation - needs analysis"
}
```

### Final Approval (Manager)
```javascript
await POST /manager/finalize {
  proposalId: id,
  comment: "Budget approved for implementation"
}
```

---

## Database Fields to Know

```javascript
proposal = {
  status: "Forwarded to Officer",              // Current state
  currentAssigneeRole: "BUDGET_OFFICER",       // Who has it now
  pendingWithRoles: ["BUDGET_OFFICER"],        // Who can act
  bypassedAnalyst: true,                       // Was analyst skipped?
  workflowHistory: [                           // Full audit trail
    {
      action: "REVIEWER_APPROVE_AND_FORWARD",
      comment: "Looks good, sending to approver",
      userId: "...",
      userName: "Jane Reviewer",
      timestamp: "2025-11-07T10:30:00Z",
      previousStatus: "Forwarded to Reviewer",
      newStatus: "Forwarded to Approver"
    }
  ]
}
```

---

## Deployment Checklist

- [ ] Copy `proposalWorkflowController_refactored.js` to controllers folder
- [ ] Update `proposalWorkflowRoutes.js` with imports and routes
- [ ] Test all 6 role endpoints
- [ ] Verify budget item sync
- [ ] Check BRD dashboard access
- [ ] Test error cases
- [ ] Load test performance
- [ ] Update frontend to use new endpoints
- [ ] Deploy to staging
- [ ] Verify in production

---

## Troubleshooting

**Proposal won't submit?**
- Check proposal status is "Draft"
- Check user role is PREPARER
- Check comment is not empty

**Can't see proposal?**
- Verify user role
- Check proposal status matches your role
- Ask BRD admin to check dashboard

**Notification not sent?**
- Check Notification model in DB
- Verify recipient role exists
- Check SMTP settings

**Status not updated?**
- Check proposal ID is valid
- Verify role permissions
- Check network request succeeded

---

## One More Thing

**Every endpoint requires:**
1. Valid authentication token
2. Correct user role
3. Non-empty comment
4. Valid proposal ID
5. Correct status for the action

That's it! The system validates everything else.

---

**Need more details?** Read `PROPOSAL_WORKFLOW_REFACTORED_SEPTEMBER_2025.md`  
**Ready to code?** Start with `proposalWorkflowController_refactored.js`  
**Questions?** Check the test scenarios in the full docs.

---

*Quick Start v1.0 - November 7, 2025*
