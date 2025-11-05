# 📋 Budget Planning Analyst Region Assignment - Implementation Guide

## Overview
This document describes the implementation of region-based filtering for Budget Planning Analyst users. Budget Planning Analysts can now be assigned to either:
- **NIA-Wide**: Access proposals from all regions
- **Specific Regions**: Access proposals from only selected regions

## Changes Made

### 1. Frontend Changes (HierarchicalUserAssignmentPage.jsx)

#### Updated ACCESS_LEVELS
Changed "Budget Admin Level" to "Budget Revenue Division Level":
```javascript
{ value: 'FULL', label: 'Budget Revenue Division Level', ... }
```

#### Added Region Selection UI for Budget Planning Analyst
When a user with role `BUDGET_PLANNING_ANALYST` is selected, two options appear:

**Option 1: NIA-Wide / All Regions**
- Allows analyst to access proposals from all regions
- No specific region selection needed

**Option 2: Specific Regions**
- User can select one or more specific regions
- Analyst can only access proposals from selected regions
- Validation requires at least one region to be selected

#### Form Data Updates
Added to formData state:
```javascript
{
  isNIAWide: false,        // Toggle for NIA-Wide vs specific regions
  assignedRegions: []      // List of region IDs for specific region assignment
}
```

#### Submission Validation
When submitting Budget Planning Analyst assignment:
```javascript
// Validate region selection
if (formData.userRole === 'BUDGET_PLANNING_ANALYST' && 
    !formData.isNIAWide && 
    formData.assignedRegions.length === 0) {
  // Show error: "Budget Planning Analyst must be assigned to at least one region or have NIA-Wide access"
}
```

### 2. Backend Model Changes (HierarchicalUserAssignment.js)

Added new fields to schema:
```javascript
// Budget Planning Analyst Region Configuration
isNIAWide: {
  type: Boolean,
  default: false,
  description: 'If true, can access proposals from all regions'
}

assignedRegions: {
  type: [mongoose.Schema.Types.ObjectId],
  ref: 'region',
  default: [],
  description: 'Specific regions assigned (only used if isNIAWide is false)'
}
```

### 3. Backend Controller Changes (HierarchicalUserAssignmentController.js)

Updated `createOrUpdateHierarchicalAssignment()` to handle region data:
```javascript
const assignmentPayload = {
  // ... existing fields ...
  
  // NEW: Budget Planning Analyst region configuration
  isNIAWide: req.body.isNIAWide === true,
  assignedRegions: (userRole === 'BUDGET_PLANNING_ANALYST' && req.body.assignedRegions) 
    ? req.body.assignedRegions 
    : []
};
```

Updated populate query to include assignedRegions:
```javascript
const populatedAssignment = await HierarchicalUserAssignment
  .findById(assignment._id)
  .populate('regionId', 'Region regionName RegionName _id')
  .populate('departmentId', 'Department departmentName DepartmentName _id')
  .populate('assignedRegions', 'Region regionName RegionName _id')  // NEW
  .lean();
```

### 4. New Middleware (budgetPlanningAnalystAccessControl.js)

Created new middleware to enforce region-based access control:

```javascript
// Usage in routes:
router.get('/proposals', 
  ...authenticatedRoute(),
  budgetPlanningAnalystAccessControl('read'),  // NEW MIDDLEWARE
  getProposals
);
```

#### Key Functions:

**budgetPlanningAnalystAccessControl(operation)**
- Filters proposals based on analyst's region assignment
- NIA-Wide analysts: no filtering
- Specific region analysts: only see proposals from assigned regions
- Adds `req.regionFilters` and `req.analystAccessControl` to request

**shouldRouteToAnalyst(submitterRegion, analystAssignment)**
- Determines if a proposal from a specific region should be routed to an analyst
- Returns true if:
  - Analyst has NIA-Wide access, OR
  - Analyst's assigned regions include submitter's region

**findAppropriateAnalysts(submitterRegion)**
- Finds all Budget Planning Analysts that should receive a proposal
- Checks both NIA-Wide and specific region assignments
- Used when routing proposals to analysts

## Implementation Workflow

### Scenario 1: NIA-Wide Budget Planning Analyst
1. Admin creates assignment for user with role `BUDGET_PLANNING_ANALYST`
2. Admin selects "NIA-Wide / All Regions" option
3. `isNIAWide = true`, `assignedRegions = []`
4. Analyst can see ALL proposals from all regions
5. Any proposal submitted from any region is visible to this analyst

### Scenario 2: Specific Region Budget Planning Analyst
1. Admin creates assignment for user with role `BUDGET_PLANNING_ANALYST`
2. Admin selects "Specific Regions" option
3. Admin selects one or more regions (e.g., MARIIS, CALABARZON)
4. `isNIAWide = false`, `assignedRegions = [region_id_1, region_id_2]`
5. Analyst can see ONLY proposals from MARIIS and CALABARZON
6. Proposal from MARIIS region is visible to analyst assigned to MARIIS
7. Proposal from different region is NOT visible to analyst

## Database Queries

### Query 1: Get all NIA-Wide Budget Planning Analysts
```javascript
const niaWideAnalysts = await HierarchicalUserAssignment.find({
  userRole: 'BUDGET_PLANNING_ANALYST',
  isNIAWide: true,
  isActive: true
});
```

### Query 2: Get Budget Planning Analysts for a specific region
```javascript
const regionAnalysts = await HierarchicalUserAssignment.find({
  userRole: 'BUDGET_PLANNING_ANALYST',
  isActive: true,
  $or: [
    { isNIAWide: true },
    { assignedRegions: regionId }
  ]
});
```

### Query 3: Get analyst's accessible proposals (in controller)
```javascript
const analyst = await HierarchicalUserAssignment.findOne({ 
  userId, 
  userRole: 'BUDGET_PLANNING_ANALYST',
  isActive: true
}).populate('assignedRegions');

if (analyst.isNIAWide) {
  // Get all proposals
  const proposals = await Proposal.find({ status: 'Department Submitted' });
} else {
  // Get proposals from assigned regions only
  const regionNames = analyst.assignedRegions.map(r => r.Region);
  const proposals = await Proposal.find({
    region: { $in: regionNames },
    status: 'Department Submitted'
  });
}
```

## API Changes

### POST /api/hierarchical-rbac/assignments

**Request body for Budget Planning Analyst:**
```json
{
  "userId": "908785",
  "userName": "John Analyst",
  "email": "john@nia.gov",
  "userRole": "BUDGET_PLANNING_ANALYST",
  "assignmentLevel": "RESPONSIBILITY_CENTER",
  "isNIAWide": false,
  "assignedRegions": ["region_id_1", "region_id_2"]
}
```

**Request body for NIA-Wide Budget Planning Analyst:**
```json
{
  "userId": "908785",
  "userName": "Jane NIA-Wide",
  "email": "jane@nia.gov",
  "userRole": "BUDGET_PLANNING_ANALYST",
  "assignmentLevel": "RESPONSIBILITY_CENTER",
  "isNIAWide": true,
  "assignedRegions": []
}
```

### GET /api/hierarchical-rbac/assignments/{userId}

**Response includes region data:**
```json
{
  "success": true,
  "assignment": {
    "userId": "908785",
    "userRole": "BUDGET_PLANNING_ANALYST",
    "isNIAWide": false,
    "assignedRegions": [
      {
        "_id": "region_id_1",
        "Region": "MARIIS",
        "regionName": "MARIIS"
      },
      {
        "_id": "region_id_2",
        "Region": "CALABARZON",
        "regionName": "CALABARZON"
      }
    ]
  }
}
```

## Integration with Proposal Routes

### Step 1: Add Middleware to Proposal Routes

```javascript
const { budgetPlanningAnalystAccessControl } = require('../middleware/budgetPlanningAnalystAccessControl');

// GET proposals - with region filtering
router.get('/proposals', 
  ...authenticatedRoute(),
  budgetPlanningAnalystAccessControl('read'),
  getProposals
);

// GET specific proposal
router.get('/proposals/:id',
  ...authenticatedRoute(),
  budgetPlanningAnalystAccessControl('read'),
  getProposalById
);
```

### Step 2: Update Controllers to Use Filters

```javascript
const getProposals = async (req, res) => {
  try {
    const regionFilters = req.regionFilters || {};  // NEW: From middleware
    const query = {
      status: 'Department Submitted',
      ...regionFilters  // NEW: Apply region filtering
    };

    const proposals = await Proposal.find(query);
    return res.json({
      success: true,
      proposals,
      appliedFilters: regionFilters  // NEW: Show applied filters
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
```

## Testing Scenarios

### Test 1: Create NIA-Wide Budget Planning Analyst
```bash
# 1. Go to Hierarchical User Assignments page (Admin)
# 2. Enter user ID: 908785
# 3. Select role: BUDGET_PLANNING_ANALYST
# 4. Select assignment level: RESPONSIBILITY_CENTER
# 5. Select "NIA-Wide / All Regions"
# 6. Click UPDATE ASSIGNMENT
# Expected: Assignment saved with isNIAWide=true
```

### Test 2: Create Region-Specific Budget Planning Analyst
```bash
# 1. Go to Hierarchical User Assignments page (Admin)
# 2. Enter user ID: 908786
# 3. Select role: BUDGET_PLANNING_ANALYST
# 4. Select assignment level: RESPONSIBILITY_CENTER
# 5. Select "Specific Regions"
# 6. Select regions: MARIIS, CALABARZON
# 7. Click UPDATE ASSIGNMENT
# Expected: Assignment saved with specific regions
```

### Test 3: Proposal Visibility
```bash
# 1. Login as Budget Planning Analyst (MARIIS assigned)
# 2. View All Proposals page
# 3. Should see:
#    - Proposals submitted from MARIIS ✓
#    - Proposals submitted from other regions ✗
```

### Test 4: Proposal Routing
```bash
# 1. Submit proposal from MARIIS region
# 2. Should be visible to:
#    - NIA-Wide analysts ✓
#    - MARIIS-assigned analysts ✓
#    - Other region analysts ✗
```

## Validation Rules

### For Budget Planning Analyst Assignment:
1. Must select either "NIA-Wide" or "Specific Regions"
2. If "Specific Regions" selected:
   - Must select at least one region
   - Cannot be empty
3. If "NIA-Wide" selected:
   - assignedRegions array must be empty
   - isNIAWide must be true

### Validation Error Messages:
- "Budget Planning Analyst must be assigned to at least one region or have NIA-Wide access"
- "Please select at least one region"
- "Budget Planning Analyst assignment requires region configuration"

## Configuration Reference

### Assignment Levels for Budget Planning Analyst:
- Typically uses `RESPONSIBILITY_CENTER` level
- Can also use `OFFICE` level depending on organization structure
- NOT used with `DIVISION` or `FULL` levels (those are for other roles)

### Compatible User Roles with Region Assignment:
- ✓ `BUDGET_PLANNING_ANALYST` (NEW feature)
- Future: Could extend to `BUDGET_OFFICER`, `OVERALL_BUDGET_APPROVER` if needed

### Region Data Sources:
- Regions populated from `Region` collection
- Displayed in dropdown as `Region` or `region.Region`
- Used in filtering proposals by `submitterRegion` or `region` field

## Maintenance & Support

### How to Change Analyst's Region Assignment:
1. Go to Hierarchical User Assignments page
2. Find analyst in "Current Assignments" table
3. Click Edit icon
4. Modify region selection
5. Click "Update Assignment"

### How to Convert NIA-Wide to Specific Regions:
1. Click Edit on analyst assignment
2. Click "Specific Regions" button
3. Select desired regions
4. Click "Update Assignment"

### How to Monitor Assignments:
```javascript
// Check analyst assignments
db.hierarchicaluserassignments.find({
  userRole: 'BUDGET_PLANNING_ANALYST',
  isActive: true
}).pretty()

// See region distribution
db.hierarchicaluserassignments.find({
  userRole: 'BUDGET_PLANNING_ANALYST'
}).forEach(a => {
  console.log(`${a.userId}: ${a.isNIAWide ? 'NIA-Wide' : a.assignedRegions.length + ' regions'}`);
});
```

## Future Enhancements

1. **Audit Trail**: Track changes to analyst region assignments
2. **Region Capacity**: Monitor how many analysts per region
3. **Reassignment Logic**: Automatically reassign proposals when analyst region assignment changes
4. **Alerts**: Notify analysts when proposals from their regions are submitted
5. **Dashboard**: Show analyst access statistics and proposal distribution

## Troubleshooting

### Issue: Analyst cannot see any proposals
**Solution**: Check if analyst has region assignment:
```javascript
const assignment = await HierarchicalUserAssignment.findOne({ userId });
console.log('isNIAWide:', assignment.isNIAWide);
console.log('assignedRegions:', assignment.assignedRegions);
```

### Issue: Wrong proposals visible
**Solution**: Verify proposal's region matches analyst's assignment:
```javascript
const proposal = await Proposal.findById(proposalId);
console.log('Proposal region:', proposal.region);
// Should match one of analyst's assignedRegions
```

### Issue: Database migration from old system
**Solution**: Ensure all Budget Planning Analyst records have region configuration:
```javascript
// Set default to NIA-Wide for existing analysts
db.hierarchicaluserassignments.updateMany(
  { userRole: 'BUDGET_PLANNING_ANALYST', isNIAWide: { $exists: false } },
  { $set: { isNIAWide: true, assignedRegions: [] } }
);
```

---
**Status**: ✅ Implementation Complete  
**Date**: November 4, 2025  
**Version**: 1.0  
