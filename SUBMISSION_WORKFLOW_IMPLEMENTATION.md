# 🔄 Submission Workflow System Implementation

## Problem Solved

Ang problema ay nakikita agad ng Region level ang lahat ng data mula sa Department level kahit hindi pa naman submitted. Kailangan may proper approval workflow kung saan:

- **Division Level**: Kailangan i-submit sa Department para makita
- **Department Level**: Kailangan i-approve ang mga submission from Division at i-submit sa Region  
- **Region Level**: Makikita lang ang mga na-submit na data mula sa Department

## Solution Overview

Ginawa namin ang **Submission Workflow Control System** na nag-control sa visibility ng data based sa submission status:

### Data Visibility Rules

#### Division Level Users
- ✅ Makikita: Lahat ng kanilang division data (anumang status)
- ❌ Hindi makikita: Data from other divisions (kahit same department)

#### Department Level Users  
- ✅ Makikita: 
  - Sariling department data (anumang status)
  - **SUBMITTED** data lang from divisions sa kanilang department
- ❌ Hindi makikita: 
  - Draft/Not Submitted data from divisions
  - Data from other departments

#### Region Level Users
- ✅ Makikita:
  - Sariling region data (anumang status) 
  - **SUBMITTED** data lang from departments sa kanilang region
- ❌ Hindi makikita:
  - Draft/Not Submitted data from departments
  - Data from other regions

## Technical Implementation

### 1. Enhanced Middleware (`submissionWorkflowControl.js`)

```javascript
// Replaces basic hierarchical filtering with submission-aware filtering
const submissionFilters = {
  $and: [
    { region: userRegion },
    {
      $or: [
        // Own level data (any status)
        { originalLevel: userLevel },
        // Submitted data from lower levels
        { 
          originalLevel: 'DIVISION',
          status: { $in: ['Submitted', 'Approved'] }
        }
      ]
    }
  ]
};
```

### 2. Workflow Role Management (`workflowRoleManager.js`)

Auto-assigns roles based on assignment level:
- **Division**: `divisionCreator`
- **Department**: `departmentCreator`, `departmentConsolidator` 
- **Region**: `regionCreator`, `regionFinalVerifier`

### 3. Submission API Routes (`submissionWorkflowRoutes.js`)

#### Division Actions
- `POST /api/submission-workflow/division/submit-to-department`
  - Changes status from "Draft" to "Submitted"
  - Now visible to Department level

#### Department Actions  
- `POST /api/submission-workflow/department/approve-and-submit`
  - Approves division submissions
  - Submits to Region for final approval
  
- `POST /api/submission-workflow/department/submit-to-region`
  - Submits own department data to Region

#### Region Actions
- `POST /api/submission-workflow/region/final-approval` 
  - Provides final approval
  - Changes status to "Approved"

### 4. Enhanced Data Retrieval

Modified `getProposals()` controller to use submission workflow filters:

```javascript
// Uses submissionWorkflowFilters instead of basic hierarchicalFilters
if (req.submissionWorkflowFilters) {
  Object.assign(query, req.submissionWorkflowFilters);
}
```

## Workflow Process

### Step 1: Division Creates Data
```
Division User creates proposal
↓
Status: "Draft" 
↓
Visible to: Division level only
```

### Step 2: Division Submits to Department
```
Division User clicks "Submit to Department"
↓
Status: "Draft" → "Submitted"
↓
Visible to: Division + Department levels
```

### Step 3: Department Reviews and Approves
```
Department User with "departmentConsolidator" role
↓
Reviews division submissions
↓
Clicks "Approve and Submit to Region"
↓
Visible to: Division + Department + Region levels
```

### Step 4: Region Final Approval
```
Region User with "regionFinalVerifier" role
↓
Reviews submitted data
↓
Clicks "Final Approval"
↓
Status: "Submitted" → "Approved"
```

## Database Schema Changes

### Enhanced Status Tracking
```javascript
// Added to all proposal models
{
  status: ["Draft", "Submitted", "Approved", "Returned"],
  originalLevel: ["DIVISION", "DEPARTMENT", "REGION"],
  lastWorkflowTransition: String,
  submittedToDepartmentAt: Date,
  submittedToDepartmentBy: String,
  submittedToRegionAt: Date, 
  submittedToRegionBy: String,
  finalApprovedAt: Date,
  finalApprovedBy: String
}
```

### Workflow Roles
```javascript
// In HierarchicalUserAssignment
workflowRoles: [
  'divisionCreator',
  'divisionApprover', 
  'departmentCreator',
  'departmentConsolidator',
  'departmentSubmission',
  'regionCreator',
  'regionFinalVerifier'
]
```

## Setup Instructions

### 1. Run Setup Script
```bash
cd SERVER
node scripts/setupSubmissionWorkflow.js
```

### 2. Assign Workflow Roles
```javascript
// Automatically assigned based on user level:
// Division → divisionCreator
// Department → departmentCreator, departmentConsolidator  
// Region → regionCreator, regionFinalVerifier
```

### 3. Test Workflow
1. **Division User**: Create data, submit to department
2. **Department User**: Approve division data, submit to region
3. **Region User**: Provide final approval

## API Usage Examples

### Division Submission
```javascript
POST /api/submission-workflow/division/submit-to-department
{
  "ids": ["proposal_id_1", "proposal_id_2"],
  "entity": "personnel",
  "submissionNote": "Ready for department review"
}
```

### Department Approval
```javascript
POST /api/submission-workflow/department/approve-and-submit  
{
  "ids": ["proposal_id_1", "proposal_id_2"],
  "entity": "personnel", 
  "approvalNote": "Approved and forwarded to region"
}
```

### Region Final Approval
```javascript
POST /api/submission-workflow/region/final-approval
{
  "ids": ["proposal_id_1", "proposal_id_2"],
  "entity": "personnel",
  "finalNote": "Final approval granted"
}
```

### Check Pending Approvals
```javascript
// For Department users
GET /api/submission-workflow/department/pending-approvals?entity=personnel

// For Region users  
GET /api/submission-workflow/region/pending-approvals?entity=personnel
```

## Benefits

### 1. **Proper Data Privacy**
- Higher levels can't see draft data from lower levels
- Only submitted data is visible upstream

### 2. **Clear Approval Process**  
- Division → Department → Region workflow
- Each level has specific approvers
- Audit trail of all submissions

### 3. **Role-Based Access**
- Workflow roles control who can approve at each level
- Automatic role assignment based on organizational level

### 4. **Status Transparency**
- Clear indication of submission status
- Workflow transition tracking
- Approval timestamps and approvers

## Migration from Old System

### Before (Problem)
```
Region Level sees ALL Department data immediately
Department Level sees ALL Division data immediately  
No submission workflow or approval process
```

### After (Solution)
```
Region Level sees only SUBMITTED Department data
Department Level sees only SUBMITTED Division data
Proper submission workflow with approvals required
```

## Frontend Integration Points

### 1. **Status Indicators**
- Show submission status (Draft/Submitted/Approved)
- Display workflow transition information

### 2. **Action Buttons**
- "Submit to Department" (Division level)
- "Approve and Submit" (Department level) 
- "Final Approval" (Region level)

### 3. **Pending Approvals View**
- List of submissions waiting for approval
- Filter by entity type (personnel, mooe, capital, etc.)

### 4. **Workflow Dashboard**
- Overview of submission status
- Count of pending approvals by level

## Security Features

### 1. **Workflow Role Enforcement**
- Only users with appropriate roles can approve
- API endpoints check workflow permissions

### 2. **Organizational Boundaries**
- Users can only approve within their assigned organizational units
- Cross-organizational access prevented

### 3. **Audit Logging**
- All workflow transitions logged
- Timestamp and user tracking
- Submission notes and approval comments

---

**Implementation Date**: September 11, 2025  
**Status**: ✅ Implemented and Ready for Testing  
**Author**: GitHub Copilot
