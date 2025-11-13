# Audit Trail & Change Logging Feature

## Overview
Comprehensive audit trail system that tracks all changes made to budget proposals, including who made the change, when it was made, and what was changed (old value → new value).

## Features Implemented

### 1. Backend Change Tracking (newProposalWorkflowController.js)

#### Updated `updateProposal` Function
- **Location**: `SERVER/controllers/newProposalWorkflowController.js:625-717`
- **Functionality**:
  - Compares new proposal values with existing values
  - Only logs fields that have actual changes
  - Tracks all editable fields:
    - `title`
    - `description`
    - `modelType`
    - `fiscalYear`
    - `amount`
    - `income`
    - `personnel`
    - `mooe`
    - `capitalOutlay`

#### Change Log Structure
Each change is stored in `workflowHistory` array with:
```javascript
{
  action: 'EDIT',
  performedBy: userId,
  performedByName: userName,
  position: userRole,
  fromStatus: proposal.status,
  toStatus: proposal.status,
  comment: 'Fields updated: title, amount',
  changes: {
    title: {
      oldValue: 'Previous Title',
      newValue: 'New Title'
    },
    amount: {
      oldValue: 100000,
      newValue: 150000
    }
  },
  timestamp: new Date(),
  changeType: 'PROPOSAL_EDIT'
}
```

#### New `getAuditTrail` Endpoint
- **Route**: `GET /api/newProposalWorkflow/proposals/:id/audit-trail`
- **Response**:
```javascript
{
  success: true,
  data: {
    proposalId: "...",
    proposalTitle: "...",
    totalChanges: 5,
    changes: [
      {
        action: 'EDIT',
        performedBy: 'John Doe',
        role: 'BUDGET PLANNING ANALYST',
        timestamp: '2025-11-11T10:30:00Z',
        changedFields: ['amount', 'description'],
        details: {
          amount: {
            oldValue: 100000,
            newValue: 150000
          },
          description: {
            oldValue: 'Old description',
            newValue: 'New description'
          }
        },
        comment: 'Fields updated: amount, description'
      }
    ]
  }
}
```

### 2. Updated Routes (newProposalWorkflowRoutes.js)
```javascript
router.get('/proposals/:id/audit-trail', newProposalWorkflowController.getAuditTrail);
```

### 3. Frontend UI Components (NewProposalWorkflowPage.jsx)

#### New State Variables
```javascript
const [auditTrailDialogOpen, setAuditTrailDialogOpen] = useState(false);
const [auditTrailData, setAuditTrailData] = useState([]);
const [auditTrailLoading, setAuditTrailLoading] = useState(false);
```

#### Action Menu Button
- **Label**: "View Audit Trail"
- **Color**: Orange (#d97706)
- **Icon**: ExpandMoreIcon
- **Always Available**: Yes, for all users on all proposals

#### Handler Function
```javascript
const handleViewAuditTrail = async (proposal) => {
  setAuditTrailLoading(true);
  setSelectedProposal(proposal);
  
  try {
    const response = await api.get(`/api/newProposalWorkflow/proposals/${proposal._id}/audit-trail`);
    
    if (response.data.success) {
      setAuditTrailData(response.data.data.changes || []);
      setAuditTrailDialogOpen(true);
    } else {
      toast.error('Failed to fetch audit trail');
    }
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    toast.error('Failed to load audit trail');
  } finally {
    setAuditTrailLoading(false);
  }
};
```

#### Audit Trail Dialog Component
Displays comprehensive table with columns:
1. **CHANGED BY** - User name who made the change
2. **ROLE** - User's role (BUDGET PLANNING ANALYST, etc.)
3. **FIELDS CHANGED** - Comma-separated list of modified fields
4. **OLD VALUE → NEW VALUE** - Detailed before/after values per field
   - Old values shown in red
   - New values shown in green
   - Field names highlighted in orange
   - Supports long values with 30-char preview
5. **DATE & TIME** - Timestamp of the change (locale-specific format)

**Visual Features**:
- Orange header (#d97706) for audit trail theme
- Sticky table header for easy scrolling
- Hover effects on rows
- Color-coded value changes (red for old, green for new)
- Loading spinner while fetching
- "No changes recorded" message for proposals without edits

## Usage Scenarios

### Scenario 1: Budget Analyst Edits Proposal Amount
1. Budget Analyst clicks "View Audit Trail" on a proposal
2. Dialog opens showing all historical changes
3. Can see:
   - Who changed the amount and when
   - Old amount vs new amount
   - What role made the change
   - Any other fields that were changed simultaneously

### Scenario 2: Compliance/Audit Review
1. Auditor wants to see all modifications to a proposal
2. Clicks "View Audit Trail"
3. Complete history displayed with:
   - Every edit attempt
   - User responsible for each change
   - Exact old/new values
   - Timestamps in readable format

### Scenario 3: Draft Proposal Creation
1. Budget Preparer creates draft
2. Makes multiple edits (title, description, amount)
3. Each edit is individually logged with all changes
4. Can track the entire evolution of the proposal

## Technical Details

### Change Detection Logic
```javascript
// Only records changes where old value !== new value
const changes = {};
allowedFields.forEach(field => {
  if (req.body[field] !== undefined && req.body[field] !== proposal[field]) {
    updates[field] = req.body[field];
    changes[field] = {
      oldValue: proposal[field],
      newValue: req.body[field]
    };
  }
});

// If no changes detected, returns without creating history entry
if (Object.keys(changes).length === 0) {
  return res.json({
    success: true,
    message: 'No changes detected',
    data: proposal
  });
}
```

### Database Storage
- Stored in `NewProposalWorkflow` model's `workflowHistory` array
- Each entry includes complete change details
- Immutable once stored (audit trail cannot be modified)
- Automatically timestamps all entries

### Permission Model
- **View Access**: All authenticated users can view audit trail
- **Edit Tracking**: Tracks edits from:
  - Draft creators (BUDGET PREPARER)
  - BRD staff members (PLANNING ANALYST, OFFICER, MANAGER)
- **Anonymous Edits**: System captures user info from request context

## Backend Logging
All changes are logged to console with format:
```
[UPDATE_PROPOSAL] Changes made to proposal {proposalId}
[UPDATE_PROPOSAL] User: {userName} Role: {userRole}
[UPDATE_PROPOSAL] Changes: {
  fieldName: {
    oldValue: value,
    newValue: value
  }
}
```

## API Integration

### Frontend Calls
```javascript
// Get audit trail for a proposal
const response = await api.get(`/api/newProposalWorkflow/proposals/${proposalId}/audit-trail`);
```

### Response Structure
- **success**: boolean
- **message**: string
- **data**: Object containing:
  - **proposalId**: Proposal ID
  - **proposalTitle**: Proposal title
  - **totalChanges**: Number of changes recorded
  - **changes**: Array of change objects (latest first)

## Testing Checklist

- [ ] Create a draft proposal
- [ ] Edit the proposal (change title, amount)
- [ ] Click "View Audit Trail"
- [ ] Verify all changes are displayed
- [ ] Verify old/new values are correct
- [ ] Verify user name and role are captured
- [ ] Verify timestamp is accurate
- [ ] Edit again and verify new entry appears
- [ ] Verify entries are sorted with latest first
- [ ] Test with empty (no edits) proposal
- [ ] Test with BRD staff edits
- [ ] Test with multiple fields changed simultaneously

## Security Considerations

1. **Immutable Records**: Once logged, audit trail cannot be modified
2. **User Attribution**: All changes tied to authenticated user
3. **Timestamp Accuracy**: Server-side timestamps prevent tampering
4. **Field-Level Granularity**: Shows exact changes per field
5. **No Data Loss**: All historical values preserved

## Future Enhancements

1. Export audit trail to PDF/Excel
2. Filter audit trail by date range
3. Filter by user/role
4. Compare two versions side-by-side
5. Track workflow actions separately from edits
6. Archive old audit trails
7. Real-time audit notifications
8. Audit trail search functionality

## Files Modified

### Backend
- `SERVER/controllers/newProposalWorkflowController.js`
  - Enhanced `updateProposal()` function
  - Added `getAuditTrail()` function
  
- `SERVER/routes/newProposalWorkflowRoutes.js`
  - Added `/proposals/:id/audit-trail` GET route

### Frontend
- `CLIENT/src/pages/NewProposalWorkflowPage.jsx`
  - Added audit trail state variables
  - Added "View Audit Trail" action to menu
  - Added `handleViewAuditTrail()` function
  - Added Audit Trail Dialog component

## Deployment Steps

1. Build frontend: `npm run build` in CLIENT directory
2. Test audit trail functionality
3. Commit and push changes
4. Server automatically picks up new routes
5. Frontend automatically loads updated UI

## Version History

- **v1.0** (2025-11-11)
  - Initial implementation
  - Field-level change tracking
  - Audit trail view endpoint
  - Frontend UI for viewing changes
  - Color-coded value display
